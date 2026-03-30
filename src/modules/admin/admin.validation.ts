import { z } from 'zod';

export const adminLoginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const listUsersSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    role: z.enum(['GUEST', 'HOST']).optional(),
    isSuspended: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  }),
});

export const listListingsSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'UNLISTED', 'SUSPENDED']).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  }),
});

export const adminUserIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const adminListingIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const listBookingsAdminSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED_BY_GUEST', 'CANCELLED_BY_HOST', 'DECLINED', 'EXPIRED']).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  }),
});

export const listPaymentsAdminSchema = z.object({
  query: z.object({
    status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  }),
});

export const listPayoutsAdminSchema = z.object({
  query: z.object({
    status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  }),
});

// ─── Moderator Management ────────────────────────────────────────────────────

export const createModeratorSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    roleIds: z.array(z.string().cuid()).optional().default([]),
  }),
});

export const updateModeratorSchema = z.object({
  params: z.object({ id: z.string().cuid() }),
  body: z.object({
    email: z.string().email('Invalid email format').optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
    roleIds: z.array(z.string().cuid()).optional(),
  }),
});

export const moderatorIdParamSchema = z.object({
  params: z.object({ id: z.string().cuid() }),
});

// ─── Review Moderation ───────────────────────────────────────────────────────

export const listReviewsAdminSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    isPublic: z.enum(['true', 'false']).optional(),
    type: z.enum(['GUEST_TO_HOST', 'HOST_TO_GUEST']).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  }),
});

export const reviewIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

// ─── Change Password ─────────────────────────────────────────────────────────

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  }),
});

// ─── Detail Views ────────────────────────────────────────────────────────────

export const adminUserDetailSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const adminListingDetailSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const adminBookingDetailSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
