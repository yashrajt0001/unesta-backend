import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createBookingSchema = z.object({
  body: z.object({
    listingId: z.string().uuid(),
    checkInDate: z.string().regex(dateRegex, 'Must be YYYY-MM-DD'),
    checkOutDate: z.string().regex(dateRegex, 'Must be YYYY-MM-DD'),
    numGuests: z.number().int().positive(),
    specialRequests: z.string().max(500).optional(),
    guestMessage: z.string().max(500).optional(),
  }),
});

export const bookingIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid booking ID'),
  }),
});

export const declineBookingSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid booking ID'),
  }),
  body: z.object({
    reason: z.string().min(1).max(500).optional(),
  }),
});

export const cancelBookingSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid booking ID'),
  }),
  body: z.object({
    reason: z.string().min(1).max(500).optional(),
  }),
});

export const getMyBookingsSchema = z.object({
  query: z.object({
    role: z.enum(['guest', 'host']).optional().default('guest'),
    status: z.enum([
      'PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED',
      'CANCELLED_BY_GUEST', 'CANCELLED_BY_HOST', 'DECLINED', 'EXPIRED',
    ]).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(10),
  }),
});

export const priceBreakdownSchema = z.object({
  query: z.object({
    listing_id: z.string().uuid(),
    check_in: z.string().regex(dateRegex, 'Must be YYYY-MM-DD'),
    check_out: z.string().regex(dateRegex, 'Must be YYYY-MM-DD'),
    guests: z.coerce.number().int().positive(),
  }),
});

export const checkAvailabilitySchema = z.object({
  query: z.object({
    listing_id: z.string().uuid(),
    check_in: z.string().regex(dateRegex, 'Must be YYYY-MM-DD'),
    check_out: z.string().regex(dateRegex, 'Must be YYYY-MM-DD'),
  }),
});
