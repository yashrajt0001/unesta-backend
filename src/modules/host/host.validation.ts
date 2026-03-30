import { z } from 'zod';

export const earningsQuerySchema = z.object({
  query: z.object({
    from: z.string().date('from must be a date (YYYY-MM-DD)').optional(),
    to: z.string().date('to must be a date (YYYY-MM-DD)').optional(),
    listingId: z.string().uuid().optional(),
  }),
});

export const analyticsQuerySchema = z.object({
  query: z.object({
    listingId: z.string().uuid().optional(),
  }),
});
