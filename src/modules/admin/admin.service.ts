import bcrypt from 'bcrypt';
import { Prisma, AmenityCategory } from '@prisma/client';
import { prisma } from '../../common/config/database.js';
import { generateAdminAccessToken } from '../../common/utils/jwt.js';
import { AppError } from '../../common/middleware/error-handler.js';

export const adminLoginService = async (email: string, password: string) => {
  const moderator = await prisma.moderator.findUnique({
    where: { email },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  });

  if (!moderator) {
    throw new AppError('Invalid email or password', 401);
  }

  const isPasswordValid = await bcrypt.compare(password, moderator.password);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  const accessToken = generateAdminAccessToken(moderator.id);

  const permissions = moderator.roles.flatMap((mr) =>
    mr.role.permissions.map((rp) => rp.permission.name),
  );

  return {
    admin: {
      id: moderator.id,
      email: moderator.email,
      roles: moderator.roles.map((mr) => mr.role.name),
      permissions: [...new Set(permissions)],
    },
    accessToken,
  };
};

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/** Percentage change, rounded to one decimal. No previous activity reads as +100%. */
const percentChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

/** groupBy rows to a plain { STATUS: count } object, with every key present. */
const countByStatus = <T extends string>(
  rows: { status: T; _count: { _all: number } }[],
  allStatuses: readonly T[],
): Record<T, number> => {
  const result = Object.fromEntries(allStatuses.map((s) => [s, 0])) as Record<T, number>;
  rows.forEach((row) => {
    result[row.status] = row._count._all;
  });
  return result;
};

const BOOKING_STATUSES = [
  'PENDING', 'AWAITING_HOST', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED',
  'CANCELLED_BY_GUEST', 'CANCELLED_BY_HOST', 'DECLINED', 'EXPIRED',
] as const;

const LISTING_STATUSES = ['DRAFT', 'PUBLISHED', 'UNLISTED', 'SUSPENDED'] as const;

export const getAdminStatsService = async () => {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 30 * DAY_MS);
  const previousWindowStart = new Date(now.getTime() - 60 * DAY_MS);

  const previousWindow = { gte: previousWindowStart, lt: windowStart };

  const [
    usersByRole,
    suspendedUsers,
    listingRows,
    bookingRows,
    grossRevenue,
    completedPayouts,
    pendingPayouts,
    openReports,
    hiddenReviews,
    usersCurrent,
    usersPrevious,
    bookingsCurrent,
    bookingsPrevious,
    revenueCurrent,
    revenuePrevious,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.user.count({ where: { isSuspended: true } }),
    prisma.listing.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.booking.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.payout.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.payout.aggregate({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.report.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    prisma.review.count({ where: { isPublic: false } }),
    prisma.user.count({ where: { createdAt: { gte: windowStart } } }),
    prisma.user.count({ where: { createdAt: previousWindow } }),
    prisma.booking.count({ where: { createdAt: { gte: windowStart } } }),
    prisma.booking.count({ where: { createdAt: previousWindow } }),
    prisma.payment.aggregate({
      where: { status: 'COMPLETED', paidAt: { gte: windowStart } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'COMPLETED', paidAt: previousWindow },
      _sum: { amount: true },
    }),
  ]);

  const bookingsByStatus = countByStatus(bookingRows, BOOKING_STATUSES);
  const listingsByStatus = countByStatus(listingRows, LISTING_STATUSES);

  const guests = usersByRole.find((r) => r.role === 'GUEST')?._count._all ?? 0;
  const hosts = usersByRole.find((r) => r.role === 'HOST')?._count._all ?? 0;

  const revenue = grossRevenue._sum.amount ?? 0;
  const payouts = completedPayouts._sum.amount ?? 0;

  const revenueCurrentTotal = revenueCurrent._sum.amount ?? 0;
  const revenuePreviousTotal = revenuePrevious._sum.amount ?? 0;

  const totalBookings = Object.values(bookingsByStatus).reduce((sum, n) => sum + n, 0);
  const totalListings = Object.values(listingsByStatus).reduce((sum, n) => sum + n, 0);

  return {
    totals: {
      users: guests + hosts,
      guests,
      hosts,
      listings: totalListings,
      publishedListings: listingsByStatus.PUBLISHED,
      bookings: totalBookings,
      grossRevenue: revenue,
      hostPayouts: payouts,
      platformFees: revenue - payouts,
    },
    // Trailing 30 days against the 30 before it, so the dashboard shows direction
    // and not just a running total.
    deltas: {
      users: { current: usersCurrent, previous: usersPrevious, changePct: percentChange(usersCurrent, usersPrevious) },
      bookings: { current: bookingsCurrent, previous: bookingsPrevious, changePct: percentChange(bookingsCurrent, bookingsPrevious) },
      revenue: { current: revenueCurrentTotal, previous: revenuePreviousTotal, changePct: percentChange(revenueCurrentTotal, revenuePreviousTotal) },
    },
    // Everything a moderator might have to act on today.
    attention: {
      openReports,
      bookingsAwaitingHost: bookingsByStatus.AWAITING_HOST,
      unpaidBookings: bookingsByStatus.PENDING,
      pendingPayoutCount: pendingPayouts._count._all,
      pendingPayoutAmount: pendingPayouts._sum.amount ?? 0,
      suspendedUsers,
      suspendedListings: listingsByStatus.SUSPENDED,
      draftListings: listingsByStatus.DRAFT,
      hiddenReviews,
    },
    bookingsByStatus,
    listingsByStatus,
  };
};

/**
 * Bookings created and revenue collected per day, with empty days filled in so
 * the chart has no gaps. `generate_series` does the filling — grouping in JS
 * would silently drop days with no activity and distort the shape.
 */
export const getStatsTimeseriesService = async (days: number) => {
  const rows = await prisma.$queryRaw<
    { date: string; bookings: number; revenue: number }[]
  >`
    SELECT to_char(d.day, 'YYYY-MM-DD')      AS date,
           COALESCE(b.bookings, 0)::int      AS bookings,
           COALESCE(p.revenue, 0)::float8    AS revenue
      FROM generate_series(
             (CURRENT_DATE - ((${days}::int - 1) * INTERVAL '1 day'))::date,
             CURRENT_DATE,
             INTERVAL '1 day'
           ) AS d(day)
      LEFT JOIN (
             SELECT "createdAt"::date AS day, COUNT(*) AS bookings
               FROM "Booking"
              WHERE "createdAt" >= (CURRENT_DATE - ((${days}::int - 1) * INTERVAL '1 day'))
              GROUP BY 1
           ) b ON b.day = d.day
      LEFT JOIN (
             SELECT "paidAt"::date AS day, SUM("amount") AS revenue
               FROM "Payment"
              WHERE "status" = 'COMPLETED'
                AND "paidAt" >= (CURRENT_DATE - ((${days}::int - 1) * INTERVAL '1 day'))
              GROUP BY 1
           ) p ON p.day = d.day
     ORDER BY d.day
  `;

  return rows;
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const listUsersService = async (
  search: string | undefined,
  role: 'GUEST' | 'HOST' | undefined,
  isSuspended: boolean | undefined,
  page: number,
  limit: number,
) => {
  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(isSuspended !== undefined ? { isSuspended } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true,
        role: true, isSuspended: true, isPhoneVerified: true, createdAt: true,
        _count: { select: { listings: true, bookingsAsGuest: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const suspendUserService = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);
  if (user.isSuspended) throw new AppError('User is already suspended', 400);
  return prisma.user.update({ where: { id: userId }, data: { isSuspended: true }, select: { id: true, isSuspended: true } });
};

export const reactivateUserService = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);
  if (!user.isSuspended) throw new AppError('User is not suspended', 400);
  return prisma.user.update({ where: { id: userId }, data: { isSuspended: false }, select: { id: true, isSuspended: true } });
};

// ─── Listings ─────────────────────────────────────────────────────────────────

export const listListingsAdminService = async (
  search: string | undefined,
  status: string | undefined,
  page: number,
  limit: number,
) => {
  const where: Prisma.ListingWhereInput = {
    ...(status ? { status: status as any } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      select: {
        id: true, title: true, city: true, country: true, status: true,
        basePrice: true, createdAt: true,
        host: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { bookings: true, reviews: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.listing.count({ where }),
  ]);

  return { listings, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const suspendListingService = async (listingId: string) => {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new AppError('Listing not found', 404);
  if (listing.status === 'SUSPENDED') throw new AppError('Listing is already suspended', 400);
  return prisma.listing.update({ where: { id: listingId }, data: { status: 'SUSPENDED' }, select: { id: true, status: true } });
};

export const unsuspendListingService = async (listingId: string) => {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new AppError('Listing not found', 404);
  if (listing.status !== 'SUSPENDED') throw new AppError('Listing is not suspended', 400);
  return prisma.listing.update({ where: { id: listingId }, data: { status: 'PUBLISHED' }, select: { id: true, status: true } });
};

// ─── Bookings ─────────────────────────────────────────────────────────────────

export const listBookingsAdminService = async (
  search: string | undefined,
  status: string | undefined,
  page: number,
  limit: number,
) => {
  const where: Prisma.BookingWhereInput = {
    ...(status ? { status: status as any } : {}),
    ...(search
      ? {
          OR: [
            { guest: { firstName: { contains: search, mode: 'insensitive' } } },
            { guest: { lastName: { contains: search, mode: 'insensitive' } } },
            { listing: { title: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [bookingsList, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      select: {
        id: true,
        checkInDate: true,
        checkOutDate: true,
        numGuests: true,
        numNights: true,
        totalPrice: true,
        hostPayout: true,
        status: true,
        bookingType: true,
        createdAt: true,
        guest: { select: { id: true, firstName: true, lastName: true, phone: true } },
        host: { select: { id: true, firstName: true, lastName: true, email: true } },
        listing: { select: { id: true, title: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return { bookings: bookingsList, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

// ─── Financials ───────────────────────────────────────────────────────────────

export const getFinancialSummaryService = async () => {
  const [revenue, payouts, pendingPayouts] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    prisma.payout.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    prisma.payout.aggregate({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
      _sum: { amount: true },
    }),
  ]);

  const totalRevenue = revenue._sum.amount ?? 0;
  const totalPayouts = payouts._sum.amount ?? 0;

  return {
    totalRevenue,
    platformFees: totalRevenue - totalPayouts,
    totalPayouts,
    pendingPayouts: pendingPayouts._sum.amount ?? 0,
  };
};

export const listPaymentsAdminService = async (
  status: string | undefined,
  page: number,
  limit: number,
) => {
  const where: Prisma.PaymentWhereInput = status ? { status: status as any } : {};

  const [paymentsList, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      select: {
        id: true,
        amount: true,
        currency: true,
        paymentMethod: true,
        status: true,
        paidAt: true,
        createdAt: true,
        booking: { select: { id: true, checkInDate: true, checkOutDate: true } },
        payer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  return { payments: paymentsList, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const listPayoutsAdminService = async (
  status: string | undefined,
  page: number,
  limit: number,
) => {
  const where: Prisma.PayoutWhereInput = status ? { status: status as any } : {};

  const [payoutsList, total] = await Promise.all([
    prisma.payout.findMany({
      where,
      select: {
        id: true,
        amount: true,
        currency: true,
        payoutMethod: true,
        status: true,
        paidAt: true,
        createdAt: true,
        booking: { select: { id: true, checkInDate: true, checkOutDate: true } },
        host: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payout.count({ where }),
  ]);

  return { payouts: payoutsList, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

// ─── Moderator Management ────────────────────────────────────────────────────

export const listModeratorsService = async () => {
  const moderators = await prisma.moderator.findMany({
    select: {
      id: true,
      email: true,
      createdAt: true,
      roles: {
        include: {
          role: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return moderators.map((m) => ({
    id: m.id,
    email: m.email,
    createdAt: m.createdAt,
    roles: m.roles.map((mr) => ({ id: mr.role.id, name: mr.role.name })),
  }));
};

export const createModeratorService = async (
  email: string,
  password: string,
  roleIds: string[],
) => {
  const existing = await prisma.moderator.findUnique({ where: { email } });
  if (existing) throw new AppError('A moderator with this email already exists', 409);

  const hashed = await bcrypt.hash(password, 10);

  const moderator = await prisma.moderator.create({
    data: {
      email,
      password: hashed,
      roles: {
        create: roleIds.map((roleId) => ({ roleId })),
      },
    },
    include: {
      roles: { include: { role: { select: { id: true, name: true } } } },
    },
  });

  return {
    id: moderator.id,
    email: moderator.email,
    createdAt: moderator.createdAt,
    roles: moderator.roles.map((mr) => ({ id: mr.role.id, name: mr.role.name })),
  };
};

export const updateModeratorService = async (
  moderatorId: string,
  data: { email?: string; password?: string; roleIds?: string[] },
) => {
  const moderator = await prisma.moderator.findUnique({ where: { id: moderatorId } });
  if (!moderator) throw new AppError('Moderator not found', 404);

  if (data.email && data.email !== moderator.email) {
    const existing = await prisma.moderator.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('Email already in use', 409);
  }

  const updateData: any = {};
  if (data.email) updateData.email = data.email;
  if (data.password) updateData.password = await bcrypt.hash(data.password, 10);

  // Update moderator fields
  await prisma.moderator.update({
    where: { id: moderatorId },
    data: updateData,
  });

  // Update roles if provided
  if (data.roleIds !== undefined) {
    await prisma.moderatorRole.deleteMany({ where: { moderatorId } });
    if (data.roleIds.length > 0) {
      await prisma.moderatorRole.createMany({
        data: data.roleIds.map((roleId) => ({ moderatorId, roleId })),
      });
    }
  }

  // Fetch final state
  const result = await prisma.moderator.findUnique({
    where: { id: moderatorId },
    include: {
      roles: { include: { role: { select: { id: true, name: true } } } },
    },
  });

  return {
    id: result!.id,
    email: result!.email,
    createdAt: result!.createdAt,
    roles: result!.roles.map((mr) => ({ id: mr.role.id, name: mr.role.name })),
  };
};

export const deleteModeratorService = async (moderatorId: string, requestingAdminId: string) => {
  if (moderatorId === requestingAdminId) {
    throw new AppError('Cannot delete your own account', 400);
  }

  const moderator = await prisma.moderator.findUnique({ where: { id: moderatorId } });
  if (!moderator) throw new AppError('Moderator not found', 404);

  await prisma.moderatorRole.deleteMany({ where: { moderatorId } });
  await prisma.moderator.delete({ where: { id: moderatorId } });
};

export const listRolesService = async () => {
  return prisma.role.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      permissions: {
        include: { permission: { select: { id: true, name: true, description: true } } },
      },
    },
    orderBy: { name: 'asc' },
  });
};

// ─── Review Moderation ───────────────────────────────────────────────────────

export const listReviewsAdminService = async (
  search: string | undefined,
  isPublic: boolean | undefined,
  type: string | undefined,
  page: number,
  limit: number,
) => {
  const where: Prisma.ReviewWhereInput = {
    ...(isPublic !== undefined ? { isPublic } : {}),
    ...(type ? { type: type as any } : {}),
    ...(search
      ? {
          OR: [
            { comment: { contains: search, mode: 'insensitive' } },
            { reviewer: { firstName: { contains: search, mode: 'insensitive' } } },
            { reviewer: { lastName: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      select: {
        id: true,
        type: true,
        rating: true,
        comment: true,
        hostResponse: true,
        isPublic: true,
        createdAt: true,
        reviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
        reviewee: { select: { id: true, firstName: true, lastName: true, email: true } },
        listing: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.review.count({ where }),
  ]);

  return { reviews, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const deleteReviewService = async (reviewId: string) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new AppError('Review not found', 404);
  await prisma.review.delete({ where: { id: reviewId } });
};

export const toggleReviewVisibilityService = async (reviewId: string) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new AppError('Review not found', 404);
  return prisma.review.update({
    where: { id: reviewId },
    data: { isPublic: !review.isPublic },
    select: { id: true, isPublic: true },
  });
};

// ─── Detail Views ────────────────────────────────────────────────────────────

export const getUserDetailService = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, firstName: true, lastName: true, phone: true,
      avatarUrl: true, dateOfBirth: true, gender: true, bio: true,
      role: true, isSuspended: true, isPhoneVerified: true,
      createdAt: true, updatedAt: true,
      _count: {
        select: {
          listings: true, bookingsAsGuest: true, bookingsAsHost: true,
          reviewsGiven: true, reviewsReceived: true, reportsCreated: true, reportsReceived: true,
        },
      },
    },
  });
  if (!user) throw new AppError('User not found', 404);
  return user;
};

export const getListingDetailService = async (listingId: string) => {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true, title: true, description: true, propertyType: true, roomType: true,
      status: true, addressLine1: true, addressLine2: true, city: true, state: true,
      country: true, postalCode: true, latitude: true, longitude: true,
      maxGuests: true, bedrooms: true, beds: true, bathrooms: true,
      checkInTime: true, checkOutTime: true, basePrice: true, cleaningFee: true,
      minimumStay: true, cancellationPolicy: true, instantBook: true,
      createdAt: true, updatedAt: true,
      host: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      images: { select: { id: true, url: true, caption: true, isCover: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } },
      amenities: { include: { amenity: { select: { id: true, name: true, category: true, icon: true } } } },
      houseRules: { select: { id: true, ruleText: true }, orderBy: { sortOrder: 'asc' } },
      _count: { select: { bookings: true, reviews: true, reports: true } },
    },
  });
  if (!listing) throw new AppError('Listing not found', 404);
  return listing;
};

export const getBookingDetailService = async (bookingId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true, checkInDate: true, checkOutDate: true,
      numGuests: true, numNights: true, basePricePerNight: true, cleaningFee: true,
      serviceFee: true, hostServiceFee: true, totalPrice: true, hostPayout: true,
      currency: true, status: true, bookingType: true,
      specialRequests: true, guestMessage: true, cancellationReason: true,
      cancelledAt: true, refundAmount: true,
      createdAt: true, updatedAt: true,
      guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      host: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      listing: { select: { id: true, title: true, city: true, country: true } },
      payment: { select: { id: true, amount: true, status: true, paymentMethod: true, paidAt: true } },
      payout: { select: { id: true, amount: true, status: true, payoutMethod: true, paidAt: true } },
      reviews: { select: { id: true, type: true, rating: true, comment: true, reviewer: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });
  if (!booking) throw new AppError('Booking not found', 404);
  return booking;
};

// ─── Change Password ─────────────────────────────────────────────────────────

export const changePasswordService = async (adminId: string, currentPassword: string, newPassword: string) => {
  const moderator = await prisma.moderator.findUnique({ where: { id: adminId } });
  if (!moderator) throw new AppError('Admin not found', 404);

  const isValid = await bcrypt.compare(currentPassword, moderator.password);
  if (!isValid) throw new AppError('Current password is incorrect', 400);

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.moderator.update({ where: { id: adminId }, data: { password: hashed } });
};

// ─── Admin Profile ────────────────────────────────────────────────────────────

export const getAdminProfileService = async (adminId: string) => {
  const moderator = await prisma.moderator.findUnique({
    where: { id: adminId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  });

  if (!moderator) {
    throw new AppError('Admin not found', 404);
  }

  const permissions = moderator.roles.flatMap((mr) =>
    mr.role.permissions.map((rp) => rp.permission.name),
  );

  return {
    id: moderator.id,
    email: moderator.email,
    roles: moderator.roles.map((mr) => mr.role.name),
    permissions: [...new Set(permissions)],
    createdAt: moderator.createdAt,
  };
};

// ─── Amenity Management ──────────────────────────────────────────────────────

export const listAmenitiesAdminService = async (
  search?: string,
  category?: AmenityCategory,
) => {
  const where: Prisma.AmenityWhereInput = {};
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (category) where.category = category;

  const amenities = await prisma.amenity.findMany({
    where,
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { listings: true } } },
  });

  return amenities.map((a) => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    category: a.category,
    sortOrder: a.sortOrder,
    listingCount: a._count.listings,
  }));
};

export const createAmenityService = async (data: {
  name: string;
  icon?: string;
  category: AmenityCategory;
  sortOrder: number;
}) => {
  const existing = await prisma.amenity.findUnique({ where: { name: data.name } });
  if (existing) throw new AppError('An amenity with this name already exists', 409);

  const amenity = await prisma.amenity.create({
    data: {
      name: data.name,
      icon: data.icon || null,
      category: data.category,
      sortOrder: data.sortOrder,
    },
  });

  return { ...amenity, listingCount: 0 };
};

export const updateAmenityService = async (
  amenityId: string,
  data: { name?: string; icon?: string | null; category?: AmenityCategory; sortOrder?: number },
) => {
  const amenity = await prisma.amenity.findUnique({ where: { id: amenityId } });
  if (!amenity) throw new AppError('Amenity not found', 404);

  if (data.name && data.name !== amenity.name) {
    const existing = await prisma.amenity.findUnique({ where: { name: data.name } });
    if (existing) throw new AppError('An amenity with this name already exists', 409);
  }

  const updated = await prisma.amenity.update({
    where: { id: amenityId },
    data,
    include: { _count: { select: { listings: true } } },
  });

  return {
    id: updated.id,
    name: updated.name,
    icon: updated.icon,
    category: updated.category,
    sortOrder: updated.sortOrder,
    listingCount: updated._count.listings,
  };
};

export const deleteAmenityService = async (amenityId: string) => {
  const amenity = await prisma.amenity.findUnique({
    where: { id: amenityId },
    include: { _count: { select: { listings: true } } },
  });
  if (!amenity) throw new AppError('Amenity not found', 404);

  if (amenity._count.listings > 0) {
    throw new AppError(
      `This amenity is used by ${amenity._count.listings} listing(s) and cannot be deleted`,
      409,
    );
  }

  await prisma.amenity.delete({ where: { id: amenityId } });
};

// ─── Rule Template Management ────────────────────────────────────────────────
// Hosts pick these when adding house rules. Rule text is copied onto the
// listing at pick time, so edits and deletes here only affect future picks.

export const listRuleTemplatesAdminService = async (search?: string) => {
  const where: Prisma.RuleTemplateWhereInput = {};
  if (search) where.text = { contains: search, mode: 'insensitive' };

  const templates = await prisma.ruleTemplate.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { text: 'asc' }],
  });

  // How many listings already carry this rule (picked, not typed by the host).
  const usage = await prisma.houseRule.groupBy({
    by: ['ruleText'],
    where: { isCustom: false, ruleText: { in: templates.map((t) => t.text) } },
    _count: { ruleText: true },
  });
  const usageByText = new Map(usage.map((u) => [u.ruleText, u._count.ruleText]));

  return templates.map((t) => ({
    id: t.id,
    text: t.text,
    sortOrder: t.sortOrder,
    listingCount: usageByText.get(t.text) ?? 0,
  }));
};

export const createRuleTemplateService = async (data: { text: string; sortOrder: number }) => {
  const existing = await prisma.ruleTemplate.findUnique({ where: { text: data.text } });
  if (existing) throw new AppError('A rule with this text already exists', 409);

  const template = await prisma.ruleTemplate.create({ data });
  return { ...template, listingCount: 0 };
};

export const updateRuleTemplateService = async (
  templateId: string,
  data: { text?: string; sortOrder?: number },
) => {
  const template = await prisma.ruleTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw new AppError('Rule template not found', 404);

  if (data.text && data.text !== template.text) {
    const existing = await prisma.ruleTemplate.findUnique({ where: { text: data.text } });
    if (existing) throw new AppError('A rule with this text already exists', 409);
  }

  const updated = await prisma.ruleTemplate.update({ where: { id: templateId }, data });
  const listingCount = await prisma.houseRule.count({
    where: { isCustom: false, ruleText: updated.text },
  });

  return { ...updated, listingCount };
};

export const deleteRuleTemplateService = async (templateId: string) => {
  const template = await prisma.ruleTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw new AppError('Rule template not found', 404);

  // Safe to delete outright — listings hold their own copy of the text.
  await prisma.ruleTemplate.delete({ where: { id: templateId } });
};
