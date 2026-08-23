import { z } from 'zod';

// lat/lng are optional — when the client knows where the user is, Google ranks
// nearby places first.
export const autocompleteSchema = z.object({
  query: z.object({
    input: z.string().min(1, 'input is required'),
    sessiontoken: z.string().optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  }),
});

export const reverseGeocodeSchema = z.object({
  query: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
  }),
});

export const placeDetailsSchema = z.object({
  query: z.object({
    place_id: z.string().min(1, 'place_id is required'),
    sessiontoken: z.string().optional(),
  }),
});
