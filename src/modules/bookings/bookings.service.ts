import { prisma } from '../../common/config/database.js';
import { AppError } from '../../common/middleware/error-handler.js';
import type { BookingStatus } from '@prisma/client';

// Service fee percentages
const GUEST_SERVICE_FEE_RATE = 0.14;
const HOST_SERVICE_FEE_RATE = 0.03;

const bookingSelectFull = {
  id: true,
  listingId: true,
  guestId: true,
  hostId: true,
  checkInDate: true,
  checkOutDate: true,
  numGuests: true,
  numNights: true,
  basePricePerNight: true,
  cleaningFee: true,
  serviceFee: true,
  totalPrice: true,
  hostPayout: true,
  currency: true,
  status: true,
  bookingType: true,
  specialRequests: true,
  guestMessage: true,
  cancelledAt: true,
  cancellationReason: true,
  refundAmount: true,
  createdAt: true,
  updatedAt: true,
  listing: {
    select: {
      id: true,
      title: true,
      city: true,
      state: true,
      country: true,
      images: { where: { isCover: true }, take: 1, select: { url: true } },
    },
  },
  guest: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  },
  host: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateNights(checkIn: string, checkOut: string): number {
  const nights = Math.ceil(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (nights <= 0) throw new AppError('Check-out must be after check-in', 400);
  return nights;
}

function calculatePricing(basePrice: number, cleaningFee: number, nights: number) {
  const subtotal = basePrice * nights;
  const serviceFee = Math.round(subtotal * GUEST_SERVICE_FEE_RATE * 100) / 100;
  const hostServiceFee = Math.round(subtotal * HOST_SERVICE_FEE_RATE * 100) / 100;
  const totalPrice = Math.round((subtotal + cleaningFee + serviceFee) * 100) / 100;
  const hostPayout = Math.round((subtotal + cleaningFee - hostServiceFee) * 100) / 100;

  return { basePricePerNight: basePrice, cleaningFee, serviceFee, hostServiceFee, totalPrice, hostPayout };
}

async function checkDateConflicts(listingId: string, checkIn: string, checkOut: string, excludeBookingId?: string) {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  // Check for overlapping active bookings
  const overlapping = await prisma.booking.findFirst({
    where: {
      listingId,
      status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
      checkInDate: { lt: checkOutDate },
      checkOutDate: { gt: checkInDate },
      ...(excludeBookingId && { id: { not: excludeBookingId } }),
    },
  });
  if (overlapping) throw new AppError('Dates are not available — overlapping booking exists', 409);

  // Check host-blocked dates
  const blocked = await prisma.listingAvailability.findFirst({
    where: {
      listingId,
      date: { gte: checkInDate, lt: checkOutDate },
      isAvailable: false,
    },
  });
  if (blocked) throw new AppError('Some dates are blocked by the host', 409);
}

// ─── Create Booking ───────────────────────────────────────────────────────────

interface CreateBookingInput {
  listingId: string;
  checkInDate: string;
  checkOutDate: string;
  numGuests: number;
  specialRequests?: string;
  guestMessage?: string;
}

export const createBookingService = async (guestId: string, input: CreateBookingInput) => {
  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    select: { id: true, hostId: true, status: true, basePrice: true, cleaningFee: true, maxGuests: true, minimumStay: true, instantBook: true },
  });

  if (!listing) throw new AppError('Listing not found', 404);
  if (listing.status !== 'PUBLISHED') throw new AppError('Listing is not available for booking', 400);
  if (listing.hostId === guestId) throw new AppError('You cannot book your own listing', 400);

  const numNights = calculateNights(input.checkInDate, input.checkOutDate);

  if (input.numGuests > listing.maxGuests) {
    throw new AppError(`Maximum ${listing.maxGuests} guests allowed`, 400);
  }
  if (listing.minimumStay && numNights < listing.minimumStay) {
    throw new AppError(`Minimum stay is ${listing.minimumStay} nights`, 400);
  }

  // Check date conflicts inside a transaction to prevent race conditions
  return prisma.$transaction(async (tx) => {
    // Re-check conflicts inside transaction
    const overlapping = await tx.booking.findFirst({
      where: {
        listingId: input.listingId,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
        checkInDate: { lt: new Date(input.checkOutDate) },
        checkOutDate: { gt: new Date(input.checkInDate) },
      },
    });
    if (overlapping) throw new AppError('Dates are not available — overlapping booking exists', 409);

    const blocked = await tx.listingAvailability.findFirst({
      where: {
        listingId: input.listingId,
        date: { gte: new Date(input.checkInDate), lt: new Date(input.checkOutDate) },
        isAvailable: false,
      },
    });
    if (blocked) throw new AppError('Some dates are blocked by the host', 409);

    const pricing = calculatePricing(listing.basePrice, listing.cleaningFee ?? 0, numNights);
    const bookingType = listing.instantBook ? 'INSTANT' : 'REQUEST';
    const status = listing.instantBook ? 'CONFIRMED' : 'PENDING';

    const booking = await tx.booking.create({
      data: {
        listingId: input.listingId,
        guestId,
        hostId: listing.hostId,
        checkInDate: new Date(input.checkInDate),
        checkOutDate: new Date(input.checkOutDate),
        numGuests: input.numGuests,
        numNights,
        ...pricing,
        status,
        bookingType,
        specialRequests: input.specialRequests,
        guestMessage: input.guestMessage,
      },
      select: bookingSelectFull,
    });

    return booking;
  });
};

// ─── Get Booking ──────────────────────────────────────────────────────────────

export const getBookingByIdService = async (id: string, userId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: bookingSelectFull,
  });

  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.guestId !== userId && booking.hostId !== userId) {
    throw new AppError('Forbidden', 403);
  }

  return booking;
};

// ─── Accept Booking ───────────────────────────────────────────────────────────

export const acceptBookingService = async (id: string, hostId: string) => {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.hostId !== hostId) throw new AppError('Forbidden', 403);
  if (booking.status !== 'PENDING') throw new AppError('Only pending bookings can be accepted', 400);

  return prisma.booking.update({
    where: { id },
    data: { status: 'CONFIRMED' },
    select: bookingSelectFull,
  });
};

// ─── Decline Booking ──────────────────────────────────────────────────────────

export const declineBookingService = async (id: string, hostId: string, reason?: string) => {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.hostId !== hostId) throw new AppError('Forbidden', 403);
  if (booking.status !== 'PENDING') throw new AppError('Only pending bookings can be declined', 400);

  return prisma.booking.update({
    where: { id },
    data: { status: 'DECLINED', cancellationReason: reason },
    select: bookingSelectFull,
  });
};

// ─── Cancel Booking ───────────────────────────────────────────────────────────

export const cancelBookingService = async (id: string, userId: string, reason?: string) => {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new AppError('Booking not found', 404);

  const isGuest = booking.guestId === userId;
  const isHost = booking.hostId === userId;
  if (!isGuest && !isHost) throw new AppError('Forbidden', 403);

  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
    throw new AppError('This booking cannot be cancelled', 400);
  }

  const status = isGuest ? 'CANCELLED_BY_GUEST' : 'CANCELLED_BY_HOST';

  return prisma.booking.update({
    where: { id },
    data: {
      status,
      cancelledAt: new Date(),
      cancellationReason: reason,
    },
    select: bookingSelectFull,
  });
};

// ─── Check-in ─────────────────────────────────────────────────────────────────

export const checkInBookingService = async (id: string, hostId: string) => {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.hostId !== hostId) throw new AppError('Forbidden', 403);
  if (booking.status !== 'CONFIRMED') throw new AppError('Only confirmed bookings can be checked in', 400);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (booking.checkInDate > today) throw new AppError('Check-in date has not arrived yet', 400);

  return prisma.booking.update({
    where: { id },
    data: { status: 'CHECKED_IN' },
    select: bookingSelectFull,
  });
};

// ─── Check-out ────────────────────────────────────────────────────────────────

export const checkOutBookingService = async (id: string, hostId: string) => {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.hostId !== hostId) throw new AppError('Forbidden', 403);
  if (booking.status !== 'CHECKED_IN') throw new AppError('Only checked-in bookings can be checked out', 400);

  return prisma.booking.update({
    where: { id },
    data: { status: 'COMPLETED' },
    select: bookingSelectFull,
  });
};

// ─── My Bookings ──────────────────────────────────────────────────────────────

export const getMyBookingsService = async (
  userId: string,
  role: 'guest' | 'host',
  page: number,
  limit: number,
  status?: BookingStatus,
) => {
  const where = {
    ...(role === 'guest' ? { guestId: userId } : { hostId: userId }),
    ...(status && { status }),
  };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      select: bookingSelectFull,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    bookings,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Price Breakdown ──────────────────────────────────────────────────────────

export const priceBreakdownService = async (
  listingId: string,
  checkIn: string,
  checkOut: string,
  guests: number,
) => {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, status: true, basePrice: true, cleaningFee: true, maxGuests: true, minimumStay: true },
  });

  if (!listing) throw new AppError('Listing not found', 404);
  if (listing.status !== 'PUBLISHED') throw new AppError('Listing is not available', 400);
  if (guests > listing.maxGuests) throw new AppError(`Maximum ${listing.maxGuests} guests allowed`, 400);

  const numNights = calculateNights(checkIn, checkOut);
  if (listing.minimumStay && numNights < listing.minimumStay) {
    throw new AppError(`Minimum stay is ${listing.minimumStay} nights`, 400);
  }

  const pricing = calculatePricing(listing.basePrice, listing.cleaningFee ?? 0, numNights);

  return {
    numNights,
    numGuests: guests,
    ...pricing,
    currency: 'INR',
  };
};

// ─── Check Availability ───────────────────────────────────────────────────────

export const checkAvailabilityService = async (listingId: string, checkIn: string, checkOut: string) => {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, status: true },
  });

  if (!listing) throw new AppError('Listing not found', 404);

  try {
    await checkDateConflicts(listingId, checkIn, checkOut);
    return { available: true };
  } catch {
    return { available: false };
  }
};
