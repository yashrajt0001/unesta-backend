import { z } from 'zod';

const propertyTypeEnum = z.enum([
  'APARTMENT', 'HOUSE', 'VILLA', 'COTTAGE', 'CABIN', 'STUDIO', 'HOTEL', 'UNIQUE',
]);

const roomTypeEnum = z.enum(['ENTIRE_PLACE', 'PRIVATE_ROOM', 'SHARED_ROOM']);

const sortEnum = z.enum(['price_asc', 'price_desc', 'newest']);

export const searchListingsSchema = z.object({
  query: z.object({
    location: z.string().min(1).optional(),
    check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'check_in must be YYYY-MM-DD').optional(),
    check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'check_out must be YYYY-MM-DD').optional(),
    guests: z.coerce.number().int().positive().optional(),
    min_price: z.coerce.number().min(0).optional(),
    max_price: z.coerce.number().positive().optional(),
    property_type: propertyTypeEnum.optional(),
    room_type: roomTypeEnum.optional(),
    amenities: z.string().optional(), // comma-separated amenity IDs
    instant_book: z.coerce.boolean().optional(),
    sort: sortEnum.optional().default('newest'),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(10),
  }),
});

export const searchSuggestionsSchema = z.object({
  query: z.object({
    q: z.string().min(1, 'Search query is required'),
  }),
});
