import { z } from 'zod';

export const autocompleteSchema = z.object({
  query: z.object({
    input: z.string().min(1, 'input is required'),
    sessiontoken: z.string().optional(),
  }),
});

export const placeDetailsSchema = z.object({
  query: z.object({
    place_id: z.string().min(1, 'place_id is required'),
    sessiontoken: z.string().optional(),
  }),
});
