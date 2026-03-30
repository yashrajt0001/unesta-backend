import { prisma } from '../../common/config/database.js';
import type { Prisma, PropertyType, RoomType } from '@prisma/client';

const listingSelectPublic = {
  id: true,
  title: true,
  propertyType: true,
  roomType: true,
  city: true,
  state: true,
  country: true,
  latitude: true,
  longitude: true,
  maxGuests: true,
  bedrooms: true,
  beds: true,
  bathrooms: true,
  basePrice: true,
  cleaningFee: true,
  instantBook: true,
  createdAt: true,
  host: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  },
  images: {
    where: { isCover: true },
    take: 1,
    select: { url: true },
  },
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchListingsInput {
  location?: string;
  check_in?: string;
  check_out?: string;
  guests?: number;
  min_price?: number;
  max_price?: number;
  property_type?: PropertyType;
  room_type?: RoomType;
  amenities?: string; // comma-separated IDs
  instant_book?: boolean;
  sort: 'price_asc' | 'price_desc' | 'newest';
  page: number;
  limit: number;
}

// ─── Search Listings ──────────────────────────────────────────────────────────

export const searchListingsService = async (input: SearchListingsInput) => {
  const where: Prisma.ListingWhereInput = {
    status: 'PUBLISHED',
  };

  // Location filter — match city or country (case-insensitive)
  if (input.location) {
    where.OR = [
      { city: { contains: input.location, mode: 'insensitive' } },
      { state: { contains: input.location, mode: 'insensitive' } },
      { country: { contains: input.location, mode: 'insensitive' } },
    ];
  }

  // Guest capacity
  if (input.guests) {
    where.maxGuests = { gte: input.guests };
  }

  // Price range
  if (input.min_price !== undefined || input.max_price !== undefined) {
    where.basePrice = {
      ...(input.min_price !== undefined && { gte: input.min_price }),
      ...(input.max_price !== undefined && { lte: input.max_price }),
    };
  }

  // Property type
  if (input.property_type) {
    where.propertyType = input.property_type;
  }

  // Room type
  if (input.room_type) {
    where.roomType = input.room_type;
  }

  // Instant book
  if (input.instant_book !== undefined) {
    where.instantBook = input.instant_book;
  }

  // Amenity filter — listing must have ALL requested amenities
  if (input.amenities) {
    const amenityIds = input.amenities.split(',').map((id) => id.trim()).filter(Boolean);
    if (amenityIds.length > 0) {
      where.AND = amenityIds.map((amenityId) => ({
        amenities: { some: { amenityId } },
      }));
    }
  }

  // Date availability filter — exclude listings that are unavailable for any date in range
  if (input.check_in && input.check_out) {
    const checkIn = new Date(input.check_in);
    const checkOut = new Date(input.check_out);

    where.NOT = {
      availability: {
        some: {
          date: { gte: checkIn, lt: checkOut },
          isAvailable: false,
        },
      },
    };

    // Also filter by minimum stay
    where.minimumStay = {
      lte: Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
    };
  }

  // Sort
  let orderBy: Prisma.ListingOrderByWithRelationInput;
  switch (input.sort) {
    case 'price_asc':
      orderBy = { basePrice: 'asc' };
      break;
    case 'price_desc':
      orderBy = { basePrice: 'desc' };
      break;
    default:
      orderBy = { createdAt: 'desc' };
  }

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      select: listingSelectPublic,
      orderBy,
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.listing.count({ where }),
  ]);

  return {
    listings,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
};

// ─── Suggestions ──────────────────────────────────────────────────────────────

export const searchSuggestionsService = async (q: string) => {
  // Get distinct cities and countries from published listings matching the query
  const [cities, states, countries] = await Promise.all([
    prisma.listing.findMany({
      where: { status: 'PUBLISHED', city: { contains: q, mode: 'insensitive' } },
      select: { city: true, state: true, country: true },
      distinct: ['city'],
      take: 5,
    }),
    prisma.listing.findMany({
      where: { status: 'PUBLISHED', state: { contains: q, mode: 'insensitive' } },
      select: { state: true, country: true },
      distinct: ['state'],
      take: 5,
    }),
    prisma.listing.findMany({
      where: { status: 'PUBLISHED', country: { contains: q, mode: 'insensitive' } },
      select: { country: true },
      distinct: ['country'],
      take: 5,
    }),
  ]);

  const suggestions: { type: 'city' | 'state' | 'country'; label: string; value: string }[] = [];

  for (const c of cities) {
    suggestions.push({ type: 'city', label: `${c.city}, ${c.state}, ${c.country}`, value: c.city });
  }
  for (const s of states) {
    suggestions.push({ type: 'state', label: `${s.state}, ${s.country}`, value: s.state });
  }
  for (const c of countries) {
    suggestions.push({ type: 'country', label: c.country, value: c.country });
  }

  // Deduplicate by label and limit to 10
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    if (seen.has(s.label)) return false;
    seen.add(s.label);
    return true;
  }).slice(0, 10);
};
