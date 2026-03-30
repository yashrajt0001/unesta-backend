import { ReportStatus, ReportReason, Prisma } from '@prisma/client';
import { prisma } from '../../common/config/database.js';
import { AppError } from '../../common/middleware/error-handler.js';

// ─── User-facing ──────────────────────────────────────────────────────────────

interface SubmitReportInput {
  reportedUserId?: string;
  reportedListingId?: string;
  bookingId?: string;
  reason: ReportReason;
  description: string;
}

export const submitReportService = async (reporterId: string, input: SubmitReportInput) => {
  // Validate reported entities exist
  if (input.reportedUserId) {
    const user = await prisma.user.findUnique({ where: { id: input.reportedUserId }, select: { id: true } });
    if (!user) throw new AppError('Reported user not found', 404);
    if (input.reportedUserId === reporterId) throw new AppError('You cannot report yourself', 400);
  }

  if (input.reportedListingId) {
    const listing = await prisma.listing.findUnique({ where: { id: input.reportedListingId }, select: { id: true } });
    if (!listing) throw new AppError('Reported listing not found', 404);
  }

  // Prevent duplicate open/under_review reports for same target
  const existing = await prisma.report.findFirst({
    where: {
      reporterId,
      ...(input.reportedUserId ? { reportedUserId: input.reportedUserId } : {}),
      ...(input.reportedListingId ? { reportedListingId: input.reportedListingId } : {}),
      status: { in: [ReportStatus.OPEN, ReportStatus.UNDER_REVIEW] },
    },
  });
  if (existing) throw new AppError('You already have an open report for this target', 409);

  return prisma.report.create({
    data: {
      reporterId,
      reportedUserId: input.reportedUserId,
      reportedListingId: input.reportedListingId,
      bookingId: input.bookingId,
      reason: input.reason,
      description: input.description,
    },
    select: {
      id: true, reason: true, status: true, description: true, createdAt: true,
    },
  });
};

export const getMyReportsService = async (reporterId: string, page: number, limit: number) => {
  const where = { reporterId };
  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      select: {
        id: true, reason: true, status: true, description: true, createdAt: true,
        reportedUser: { select: { id: true, firstName: true, lastName: true } },
        reportedListing: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.report.count({ where }),
  ]);
  return { reports, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminListReportsService = async (
  status: ReportStatus | undefined,
  reason: ReportReason | undefined,
  page: number,
  limit: number,
) => {
  const where: Prisma.ReportWhereInput = {
    ...(status ? { status } : {}),
    ...(reason ? { reason } : {}),
  };

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true, email: true } },
        reportedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        reportedListing: { select: { id: true, title: true } },
        resolvedBy: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.report.count({ where }),
  ]);

  return { reports, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const adminUpdateReportService = async (
  reportId: string,
  adminId: string,
  status: ReportStatus,
  adminNotes?: string,
) => {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw new AppError('Report not found', 404);

  const isResolving = status === ReportStatus.RESOLVED || status === ReportStatus.DISMISSED;

  return prisma.report.update({
    where: { id: reportId },
    data: {
      status,
      ...(adminNotes ? { adminNotes } : {}),
      ...(isResolving ? { resolvedById: adminId, resolvedAt: new Date() } : {}),
    },
    select: {
      id: true, status: true, adminNotes: true, resolvedAt: true,
    },
  });
};
