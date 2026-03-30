import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
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

export const getAdminStatsService = async () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    totalListings,
    totalBookings,
    monthlyBookings,
    revenue,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count({ where: { status: 'PUBLISHED' } }),
    prisma.booking.count(),
    prisma.booking.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.booking.aggregate({
      where: { status: { in: ['CONFIRMED', 'COMPLETED'] } },
      _sum: { hostPayout: true },
    }),
  ]);

  return {
    totalUsers,
    totalListings,
    totalBookings,
    monthlyBookings,
    totalRevenue: revenue._sum.hostPayout ?? 0,
  };
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
