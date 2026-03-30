import { ReviewType } from '@prisma/client';
import { prisma } from '../../common/config/database.js';
import { AppError } from '../../common/middleware/error-handler.js';

const REVIEW_WINDOW_DAYS = 14;

// ─── Booking Review Status ────────────────────────────────────────────────────

export const getBookingReviewStatusService = async (bookingId: string, userId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      guestId: true,
      listing: { select: { hostId: true } },
      status: true,
      checkOutDate: true,
    },
  });

  if (!booking) throw new AppError('Booking not found', 404);

  const isGuest = booking.guestId === userId;
  const isHost = booking.listing.hostId === userId;
  if (!isGuest && !isHost) throw new AppError('Forbidden', 403);

  if (booking.status !== 'COMPLETED') {
    return { canReview: false, reason: 'Booking is not completed' };
  }

  const checkoutDate = new Date(booking.checkOutDate);
  const deadlineDate = new Date(checkoutDate);
  deadlineDate.setDate(deadlineDate.getDate() + REVIEW_WINDOW_DAYS);
  const now = new Date();

  if (now > deadlineDate) {
    return { canReview: false, reason: 'Review window has expired' };
  }

  const reviewType = isGuest ? ReviewType.GUEST_TO_HOST : ReviewType.HOST_TO_GUEST;
  const existing = await prisma.review.findFirst({
    where: { bookingId, reviewerId: userId },
  });

  if (existing) {
    return { canReview: false, reason: 'You have already reviewed this booking' };
  }

  return {
    canReview: true,
    role: isGuest ? 'guest' : 'host',
    reviewType,
    deadlineDate,
  };
};

// ─── Submit Review ────────────────────────────────────────────────────────────

export const submitReviewService = async (
  reviewerId: string,
  input: { bookingId: string; rating: number; comment?: string },
) => {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      id: true,
      guestId: true,
      listingId: true,
      listing: { select: { hostId: true } },
      status: true,
      checkOutDate: true,
    },
  });

  if (!booking) throw new AppError('Booking not found', 404);

  const isGuest = booking.guestId === reviewerId;
  const isHost = booking.listing.hostId === reviewerId;
  if (!isGuest && !isHost) throw new AppError('Forbidden', 403);

  if (booking.status !== 'COMPLETED') {
    throw new AppError('Can only review completed bookings', 400);
  }

  const checkoutDate = new Date(booking.checkOutDate);
  const deadlineDate = new Date(checkoutDate);
  deadlineDate.setDate(deadlineDate.getDate() + REVIEW_WINDOW_DAYS);
  if (new Date() > deadlineDate) throw new AppError('Review window has expired', 400);

  const existing = await prisma.review.findFirst({
    where: { bookingId: input.bookingId, reviewerId },
  });
  if (existing) throw new AppError('You have already reviewed this booking', 409);

  const reviewType = isGuest ? ReviewType.GUEST_TO_HOST : ReviewType.HOST_TO_GUEST;
  const revieweeId = isGuest ? booking.listing.hostId : booking.guestId;

  // Check if the other party has also reviewed — if so, this review becomes public immediately
  const otherReview = await prisma.review.findFirst({
    where: { bookingId: input.bookingId, reviewerId: revieweeId },
  });

  const isPublic = !!otherReview;

  const review = await prisma.$transaction(async (tx) => {
    const newReview = await tx.review.create({
      data: {
        bookingId: input.bookingId,
        reviewerId,
        revieweeId,
        listingId: booking.listingId,
        type: reviewType,
        rating: input.rating,
        comment: input.comment,
        isPublic,
      },
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    // If the other party reviewed first, make their review public too
    if (otherReview) {
      await tx.review.update({
        where: { id: otherReview.id },
        data: { isPublic: true },
      });
    }

    return newReview;
  });

  return review;
};

// ─── Get Listing Reviews ──────────────────────────────────────────────────────

export const getListingReviewsService = async (listingId: string, page: number, limit: number) => {
  const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true } });
  if (!listing) throw new AppError('Listing not found', 404);

  const where = { listingId, type: ReviewType.GUEST_TO_HOST, isPublic: true };

  const [reviews, total, agg] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.review.count({ where }),
    prisma.review.aggregate({ where, _avg: { rating: true } }),
  ]);

  return {
    reviews,
    averageRating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Get User Reviews ─────────────────────────────────────────────────────────

export const getUserReviewsService = async (userId: string, page: number, limit: number) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new AppError('User not found', 404);

  const where = { revieweeId: userId, isPublic: true };

  const [reviews, total, agg] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        listing: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.review.count({ where }),
    prisma.review.aggregate({ where, _avg: { rating: true } }),
  ]);

  return {
    reviews,
    averageRating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Host Response ────────────────────────────────────────────────────────────

export const hostResponseService = async (reviewId: string, hostId: string, response: string) => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { listing: { select: { hostId: true } } },
  });

  if (!review) throw new AppError('Review not found', 404);
  if (review.type !== ReviewType.GUEST_TO_HOST) {
    throw new AppError('Can only respond to guest reviews', 400);
  }
  if (review.listing.hostId !== hostId) throw new AppError('Forbidden', 403);
  if (!review.isPublic) throw new AppError('Review is not yet public', 400);
  if (review.hostResponse) throw new AppError('Already responded to this review', 409);

  return prisma.review.update({
    where: { id: reviewId },
    data: { hostResponse: response },
    select: { id: true, hostResponse: true, updatedAt: true },
  });
};
