import { z } from 'zod';

export const submitReportSchema = z.object({
  body: z
    .object({
      reportedUserId: z.string().uuid().optional(),
      reportedListingId: z.string().uuid().optional(),
      bookingId: z.string().uuid().optional(),
      reason: z.enum(['SAFETY', 'FRAUD', 'DAMAGE', 'INACCURATE_LISTING', 'HARASSMENT', 'OTHER']),
      description: z.string().min(10, 'Please provide more detail').max(2000),
    })
    .refine((d) => d.reportedUserId || d.reportedListingId, {
      message: 'Must report either a user or a listing',
    }),
});

export const myReportsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(10),
  }),
});

// Admin
export const adminListReportsSchema = z.object({
  query: z.object({
    status: z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']).optional(),
    reason: z.enum(['SAFETY', 'FRAUD', 'DAMAGE', 'INACCURATE_LISTING', 'HARASSMENT', 'OTHER']).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  }),
});

export const adminReportIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const adminUpdateReportSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']),
    adminNotes: z.string().max(2000).optional(),
  }),
});
