import { z } from 'zod';

export const submitReviewSchema = z.object({
  body: z.object({
    bookingId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().min(1).max(1000).optional(),
  }),
});

export const hostResponseSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid review ID'),
  }),
  body: z.object({
    response: z.string().min(1).max(1000),
  }),
});

export const listingReviewsSchema = z.object({
  params: z.object({
    listingId: z.string().uuid('Invalid listing ID'),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(10),
  }),
});

export const userReviewsSchema = z.object({
  params: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(10),
  }),
});

export const bookingReviewStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid booking ID'),
  }),
});
