import { z } from 'zod';

const propertyTypeEnum = z.enum([
  'APARTMENT', 'HOUSE', 'VILLA', 'COTTAGE', 'CABIN', 'STUDIO', 'HOTEL', 'UNIQUE',
]);

const roomTypeEnum = z.enum(['ENTIRE_PLACE', 'PRIVATE_ROOM', 'SHARED_ROOM']);

const cancellationPolicyEnum = z.enum(['FLEXIBLE', 'MODERATE', 'FIRM']);

export const createListingSchema = z.object({
  body: z.object({
    title: z.string().min(5, 'Title must be at least 5 characters').max(50, 'Title must be at most 50 characters'),
    description: z.string().min(20, 'Description must be at least 20 characters').max(500, 'Description must be at most 500 characters'),
    propertyType: propertyTypeEnum,
    roomType: roomTypeEnum,
    addressLine1: z.string().min(1, 'Address is required'),
    addressLine2: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    country: z.string().min(1, 'Country is required'),
    postalCode: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    maxGuests: z.number().int().positive('Max guests must be a positive integer'),
    bedrooms: z.number().int().min(0),
    beds: z.number().int().positive(),
    bathrooms: z.number().positive(),
    checkInTime: z.string().optional(),
    checkOutTime: z.string().optional(),
    basePrice: z.number().positive('Base price must be positive'),
    cleaningFee: z.number().min(0).optional(),
    minimumStay: z.number().int().positive().optional(),
    cancellationPolicy: cancellationPolicyEnum.optional(),
    instantBook: z.boolean().optional(),
    amenityIds: z.array(z.string().uuid()).optional(),
    ruleTemplateIds: z.array(z.string().uuid()).optional(),
    customRules: z.array(z.string().trim().min(1).max(200)).optional(),
  }),
});

export const updateListingSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid listing ID'),
  }),
  body: z.object({
    title: z.string().min(5).max(50).optional(),
    description: z.string().min(20).max(500).optional(),
    propertyType: propertyTypeEnum.optional(),
    roomType: roomTypeEnum.optional(),
    addressLine1: z.string().min(1).optional(),
    addressLine2: z.string().optional(),
    city: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
    postalCode: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    maxGuests: z.number().int().positive().optional(),
    bedrooms: z.number().int().min(0).optional(),
    beds: z.number().int().positive().optional(),
    bathrooms: z.number().positive().optional(),
    checkInTime: z.string().optional(),
    checkOutTime: z.string().optional(),
    basePrice: z.number().positive().optional(),
    cleaningFee: z.number().min(0).optional(),
    minimumStay: z.number().int().positive().optional(),
    cancellationPolicy: cancellationPolicyEnum.optional(),
    instantBook: z.boolean().optional(),
    amenityIds: z.array(z.string().uuid()).optional(),
  }),
});

export const listingIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid listing ID'),
  }),
});

export const updateListingStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid listing ID'),
  }),
  body: z.object({
    status: z.enum(['PUBLISHED', 'UNLISTED']),
  }),
});

export const addHouseRulesSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid listing ID'),
  }),
  body: z
    .object({
      ruleTemplateIds: z.array(z.string().uuid('Invalid rule template ID')).optional(),
      customRules: z.array(z.string().trim().min(1, 'Rule text is required').max(200)).optional(),
    })
    .refine(
      (b) => (b.ruleTemplateIds?.length ?? 0) + (b.customRules?.length ?? 0) > 0,
      'Pick at least one rule or write your own',
    ),
});

export const updateAvailabilitySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid listing ID'),
  }),
  body: z.object({
    dates: z.array(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
      isAvailable: z.boolean(),
      customPrice: z.number().positive().optional(),
    })).min(1),
  }),
});

export const getAvailabilitySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid listing ID'),
  }),
  query: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
  }),
});

export const deleteHouseRuleSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid listing ID'),
    ruleId: z.string().uuid('Invalid rule ID'),
  }),
});

// The key comes from POST /api/uploads/presign — the browser has already PUT the
// bytes into R2 by the time this is called.
export const addListingImageSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid listing ID'),
  }),
  body: z.object({
    key: z.string().min(1, 'key is required'),
    isCover: z.boolean().optional().default(false),
  }),
});

export const deleteListingImageSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid listing ID'),
    imageId: z.string().uuid('Invalid image ID'),
  }),
});

export const setCoverImageSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid listing ID'),
    imageId: z.string().uuid('Invalid image ID'),
  }),
});

export const getHostListingsSchema = z.object({
  params: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(10),
  }),
});

export const reorderImagesSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid listing ID'),
  }),
  body: z.object({
    imageIds: z.array(z.string().uuid()).min(1),
  }),
});

export const getMyListingsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(10),
    status: z.enum(['DRAFT', 'PUBLISHED', 'UNLISTED', 'SUSPENDED']).optional(),
  }),
});
