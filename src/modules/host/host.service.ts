import { prisma } from '../../common/config/database.js';

// ─── Overview ─────────────────────────────────────────────────────────────────

export const getHostOverviewService = async (hostId: string) => {
  const now = new Date();
  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [
    upcomingBookings,
    pendingBookingsCount,
    unreadMessagesCount,
    recentReviews,
    monthlyEarnings,
    totalListings,
  ] = await Promise.all([
    // Upcoming bookings in next 7 days
    prisma.booking.findMany({
      where: {
        hostId,
        status: 'CONFIRMED',
        checkInDate: { gte: now, lte: in7Days },
      },
      include: {
        guest: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        listing: { select: { id: true, title: true } },
      },
      orderBy: { checkInDate: 'asc' },
      take: 5,
    }),

    // Pending booking requests
    prisma.booking.count({ where: { hostId, status: 'PENDING' } }),

    // Unread messages across all conversations
    prisma.message.count({
      where: {
        isRead: false,
        conversation: { hostId },
        senderId: { not: hostId },
      },
    }),

    // Recent reviews on host's listings
    prisma.review.findMany({
      where: { listing: { hostId }, isPublic: true },
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        listing: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),

    // This month's earnings (confirmed + completed bookings)
    prisma.booking.aggregate({
      where: {
        hostId,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { hostPayout: true },
    }),

    // Total active listings count
    prisma.listing.count({ where: { hostId, status: 'PUBLISHED' } }),
  ]);

  return {
    upcomingBookings,
    pendingBookingsCount,
    unreadMessagesCount,
    recentReviews,
    monthlyEarnings: monthlyEarnings._sum.hostPayout ?? 0,
    totalListings,
  };
};

// ─── Earnings ─────────────────────────────────────────────────────────────────

export const getHostEarningsService = async (
  hostId: string,
  from: Date,
  to: Date,
  listingId?: string,
) => {
  const where = {
    hostId,
    status: { in: ['CONFIRMED' as const, 'COMPLETED' as const] },
    createdAt: { gte: from, lte: to },
    ...(listingId ? { listingId } : {}),
  };

  const [bookings, totals] = await Promise.all([
    prisma.booking.findMany({
      where,
      select: {
        id: true,
        listingId: true,
        listing: { select: { title: true } },
        guest: { select: { id: true, firstName: true, lastName: true } },
        checkInDate: true,
        checkOutDate: true,
        numNights: true,
        totalPrice: true,
        hostPayout: true,
        hostServiceFee: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.booking.aggregate({
      where,
      _sum: { totalPrice: true, hostPayout: true, hostServiceFee: true },
      _count: { id: true },
    }),
  ]);

  return {
    bookings,
    summary: {
      totalBookings: totals._count.id,
      grossRevenue: totals._sum.totalPrice ?? 0,
      platformFees: totals._sum.hostServiceFee ?? 0,
      netEarnings: totals._sum.hostPayout ?? 0,
    },
  };
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export const getHostAnalyticsService = async (hostId: string, listingId?: string) => {
  const listingWhere = listingId
    ? { id: listingId, hostId }
    : { hostId, status: 'PUBLISHED' as const };

  const listings = await prisma.listing.findMany({
    where: listingWhere,
    select: { id: true, title: true, basePrice: true },
  });

  if (!listings.length) return { listings: [] };

  const listingIds = listings.map((l) => l.id);

  const [completedBookings, avgRatings] = await Promise.all([
    prisma.booking.findMany({
      where: { listingId: { in: listingIds }, status: 'COMPLETED' },
      select: { listingId: true, numNights: true, hostPayout: true, checkInDate: true, checkOutDate: true },
    }),
    prisma.review.groupBy({
      by: ['listingId'],
      where: { listingId: { in: listingIds }, isPublic: true },
      _avg: { rating: true },
      _count: { id: true },
    }),
  ]);

  // Build per-listing analytics
  const analyticsMap = new Map(
    listings.map((l) => [l.id, { listingId: l.id, title: l.title, completedBookings: 0, totalNights: 0, totalEarnings: 0, averageRating: null as number | null, totalReviews: 0, adr: 0 }]),
  );

  for (const b of completedBookings) {
    const entry = analyticsMap.get(b.listingId);
    if (entry) {
      entry.completedBookings += 1;
      entry.totalNights += b.numNights;
      entry.totalEarnings += b.hostPayout;
    }
  }

  for (const r of avgRatings) {
    const entry = analyticsMap.get(r.listingId);
    if (entry) {
      entry.averageRating = r._avg.rating ? Math.round(r._avg.rating * 10) / 10 : null;
      entry.totalReviews = r._count.id;
    }
  }

  // Compute ADR (average daily rate = total earnings / total nights)
  for (const entry of analyticsMap.values()) {
    entry.adr = entry.totalNights > 0 ? Math.round((entry.totalEarnings / entry.totalNights) * 100) / 100 : 0;
  }

  return { listings: Array.from(analyticsMap.values()) };
};
