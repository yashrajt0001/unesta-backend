import { z } from 'zod';

export const createWishlistSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
  }),
});

export const updateWishlistSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).max(100),
  }),
});

export const wishlistIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const addItemSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    listingId: z.string().uuid(),
    note: z.string().max(500).optional(),
  }),
});

export const removeItemSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    listingId: z.string().uuid(),
  }),
});
