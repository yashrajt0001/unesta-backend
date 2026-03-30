import { prisma } from '../../common/config/database.js';
import { AppError } from '../../common/middleware/error-handler.js';
import type { CancellationPolicy, ListingStatus, PropertyType, RoomType } from '@prisma/client';

const listingSelectPublic = {
  id: true,
  title: true,
  propertyType: true,
  roomType: true,
  status: true,
  city: true,
  state: true,
  country: true,
  latitude: true,
  longitude: true,
  maxGuests: true,
  bedrooms: true,
  beds: true,
  bathrooms: true,
  basePrice: true,
  cleaningFee: true,
  instantBook: true,
  createdAt: true,
  host: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  },
  images: {
    where: { isCover: true },
    take: 1,
    select: { url: true },
  },
} as const;

const listingSelectFull = {
  ...listingSelectPublic,
  description: true,
  addressLine1: true,
  addressLine2: true,
  postalCode: true,
  checkInTime: true,
  checkOutTime: true,
  minimumStay: true,
  cancellationPolicy: true,
  updatedAt: true,
  images: {
    orderBy: { sortOrder: 'asc' as const },
    select: { id: true, url: true, sortOrder: true, isCover: true },
  },
  amenities: {
    select: {
      amenity: {
        select: { id: true, name: true, icon: true, category: true },
      },
    },
  },
  houseRules: {
    select: { id: true, ruleText: true },
  },
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateListingInput {
  title: string;
  description: string;
  propertyType: PropertyType;
  roomType: RoomType;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  checkInTime?: string;
  checkOutTime?: string;
  basePrice: number;
  cleaningFee?: number;
  minimumStay?: number;
  cancellationPolicy?: CancellationPolicy;
  instantBook?: boolean;
  amenityIds?: string[];
  houseRules?: { ruleText: string }[];
}

type UpdateListingInput = Partial<Omit<CreateListingInput, 'amenityIds' | 'houseRules'>> & {
  amenityIds?: string[];
};

// ─── Create ───────────────────────────────────────────────────────────────────

export const createListingService = async (hostId: string, input: CreateListingInput) => {
  const { amenityIds, houseRules, ...listingData } = input;

  const user = await prisma.user.findUnique({ where: { id: hostId } });
  if (!user) throw new AppError('User not found', 404);
  if (user.role === 'GUEST') {
    await prisma.user.update({ where: { id: hostId }, data: { role: 'HOST' } });
  }

  const listing = await prisma.listing.create({
    data: {
      ...listingData,
      hostId,
      status: 'DRAFT',
      ...(amenityIds?.length && {
        amenities: {
          create: amenityIds.map((amenityId) => ({ amenityId })),
        },
      }),
      ...(houseRules?.length && {
        houseRules: {
          create: houseRules.map((rule) => ({ ruleText: rule.ruleText })),
        },
      }),
    },
    select: listingSelectFull,
  });

  return listing;
};

// ─── Get by ID ─────────────────────────────────────────────────────────────────

export const getListingByIdService = async (id: string, requesterId?: string) => {
  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      ...listingSelectFull,
      hostId: true,
    },
  });

  if (!listing) throw new AppError('Listing not found', 404);

  if (listing.status !== 'PUBLISHED' && listing.hostId !== requesterId) {
    throw new AppError('Listing not found', 404);
  }

  return listing;
};

// ─── Host's listings ───────────────────────────────────────────────────────────

export const getMyListingsService = async (
  hostId: string,
  page: number,
  limit: number,
  status?: ListingStatus,
) => {
  const where = { hostId, ...(status && { status }) };

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      select: listingSelectPublic,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.listing.count({ where }),
  ]);

  return {
    listings,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Update ────────────────────────────────────────────────────────────────────

export const updateListingService = async (id: string, hostId: string, input: UpdateListingInput) => {
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) throw new AppError('Listing not found', 404);
  if (existing.hostId !== hostId) throw new AppError('Forbidden', 403);
  if (existing.status === 'SUSPENDED') throw new AppError('Suspended listings cannot be edited', 403);

  const { amenityIds, ...listingData } = input;

  return prisma.listing.update({
    where: { id },
    data: {
      ...listingData,
      ...(amenityIds !== undefined && {
        amenities: {
          deleteMany: {},
          create: amenityIds.map((amenityId) => ({ amenityId })),
        },
      }),
    },
    select: listingSelectFull,
  });
};

// ─── Status ────────────────────────────────────────────────────────────────────

export const updateListingStatusService = async (
  id: string,
  hostId: string,
  status: 'PUBLISHED' | 'UNLISTED',
) => {
  const existing = await prisma.listing.findUnique({
    where: { id },
    include: { images: { where: { isCover: true }, take: 1 } },
  });
  if (!existing) throw new AppError('Listing not found', 404);
  if (existing.hostId !== hostId) throw new AppError('Forbidden', 403);
  if (existing.status === 'SUSPENDED') throw new AppError('Suspended listings cannot be published', 403);

  if (status === 'PUBLISHED' && existing.images.length === 0) {
    throw new AppError('A cover image is required before publishing', 400);
  }

  return prisma.listing.update({
    where: { id },
    data: { status },
    select: { id: true, status: true, updatedAt: true },
  });
};

// ─── Delete ────────────────────────────────────────────────────────────────────

export const deleteListingService = async (id: string, hostId: string) => {
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) throw new AppError('Listing not found', 404);
  if (existing.hostId !== hostId) throw new AppError('Forbidden', 403);

  const activeBooking = await prisma.booking.findFirst({
    where: { listingId: id, status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] } },
  });
  if (activeBooking) throw new AppError('Cannot delete a listing with active bookings', 409);

  await prisma.listing.delete({ where: { id } });
  return { message: 'Listing deleted successfully' };
};

// ─── House rules ───────────────────────────────────────────────────────────────

export const addHouseRulesService = async (
  id: string,
  hostId: string,
  rules: { ruleText: string }[],
) => {
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) throw new AppError('Listing not found', 404);
  if (existing.hostId !== hostId) throw new AppError('Forbidden', 403);

  await prisma.houseRule.createMany({
    data: rules.map((rule) => ({ listingId: id, ruleText: rule.ruleText })),
  });

  return prisma.houseRule.findMany({
    where: { listingId: id },
    select: { id: true, ruleText: true },
  });
};

export const deleteHouseRuleService = async (listingId: string, ruleId: string, hostId: string) => {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new AppError('Listing not found', 404);
  if (listing.hostId !== hostId) throw new AppError('Forbidden', 403);

  const rule = await prisma.houseRule.findUnique({ where: { id: ruleId } });
  if (!rule || rule.listingId !== listingId) throw new AppError('Rule not found', 404);

  await prisma.houseRule.delete({ where: { id: ruleId } });
  return { message: 'Rule deleted successfully' };
};

// ─── Availability ──────────────────────────────────────────────────────────────

interface AvailabilityDate {
  date: string;
  isAvailable: boolean;
  customPrice?: number;
}

export const updateAvailabilityService = async (
  id: string,
  hostId: string,
  dates: AvailabilityDate[],
) => {
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) throw new AppError('Listing not found', 404);
  if (existing.hostId !== hostId) throw new AppError('Forbidden', 403);

  await Promise.all(
    dates.map((d) =>
      prisma.listingAvailability.upsert({
        where: { listingId_date: { listingId: id, date: new Date(d.date) } },
        create: { listingId: id, date: new Date(d.date), isAvailable: d.isAvailable, customPrice: d.customPrice },
        update: { isAvailable: d.isAvailable, customPrice: d.customPrice ?? null },
      }),
    ),
  );

  return { message: `${dates.length} date(s) updated` };
};

export const getAvailabilityService = async (id: string, from: string, to: string) => {
  const listing = await prisma.listing.findUnique({ where: { id }, select: { id: true } });
  if (!listing) throw new AppError('Listing not found', 404);

  return prisma.listingAvailability.findMany({
    where: { listingId: id, date: { gte: new Date(from), lte: new Date(to) } },
    orderBy: { date: 'asc' },
    select: { date: true, isAvailable: true, customPrice: true },
  });
};

// ─── Images ───────────────────────────────────────────────────────────────────

export const addListingImageService = async (
  listingId: string,
  hostId: string,
  url: string,
  isCover?: boolean,
) => {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new AppError('Listing not found', 404);
  if (listing.hostId !== hostId) throw new AppError('Forbidden', 403);

  // Get the next sort order
  const maxSort = await prisma.listingImage.aggregate({
    where: { listingId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  // If this is the first image or explicitly set as cover, make it the cover
  const imageCount = await prisma.listingImage.count({ where: { listingId } });
  const shouldBeCover = isCover || imageCount === 0;

  // If setting as cover, unset existing cover
  if (shouldBeCover) {
    await prisma.listingImage.updateMany({
      where: { listingId, isCover: true },
      data: { isCover: false },
    });
  }

  const image = await prisma.listingImage.create({
    data: {
      listingId,
      url,
      sortOrder,
      isCover: shouldBeCover,
    },
  });

  return image;
};

export const deleteListingImageService = async (
  listingId: string,
  imageId: string,
  hostId: string,
) => {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new AppError('Listing not found', 404);
  if (listing.hostId !== hostId) throw new AppError('Forbidden', 403);

  const image = await prisma.listingImage.findFirst({
    where: { id: imageId, listingId },
  });
  if (!image) throw new AppError('Image not found', 404);

  await prisma.listingImage.delete({ where: { id: imageId } });

  // If deleted image was cover, make the first remaining image the cover
  if (image.isCover) {
    const first = await prisma.listingImage.findFirst({
      where: { listingId },
      orderBy: { sortOrder: 'asc' },
    });
    if (first) {
      await prisma.listingImage.update({
        where: { id: first.id },
        data: { isCover: true },
      });
    }
  }

  return { message: 'Image deleted' };
};

export const setCoverImageService = async (
  listingId: string,
  imageId: string,
  hostId: string,
) => {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new AppError('Listing not found', 404);
  if (listing.hostId !== hostId) throw new AppError('Forbidden', 403);

  const image = await prisma.listingImage.findFirst({
    where: { id: imageId, listingId },
  });
  if (!image) throw new AppError('Image not found', 404);

  await prisma.listingImage.updateMany({
    where: { listingId, isCover: true },
    data: { isCover: false },
  });

  await prisma.listingImage.update({
    where: { id: imageId },
    data: { isCover: true },
  });

  return { message: 'Cover image updated' };
};

// ─── Amenities ─────────────────────────────────────────────────────────────────

export const getAllAmenitiesService = async () => {
  return prisma.amenity.findMany({
    orderBy: { category: 'asc' },
    select: { id: true, name: true, icon: true, category: true },
  });
};
