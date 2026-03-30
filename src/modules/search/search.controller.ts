import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/types/index.js';
import { searchListingsService, searchSuggestionsService } from './search.service.js';
import type { PropertyType, RoomType } from '@prisma/client';

export const searchListings = asyncHandler(async (req: Request, res: Response) => {
  const result = await searchListingsService({
    location: req.query['location'] as string | undefined,
    check_in: req.query['check_in'] as string | undefined,
    check_out: req.query['check_out'] as string | undefined,
    guests: req.query['guests'] as number | undefined,
    min_price: req.query['min_price'] as number | undefined,
    max_price: req.query['max_price'] as number | undefined,
    property_type: req.query['property_type'] as PropertyType | undefined,
    room_type: req.query['room_type'] as RoomType | undefined,
    amenities: req.query['amenities'] as string | undefined,
    instant_book: req.query['instant_book'] as boolean | undefined,
    sort: (req.query['sort'] as 'price_asc' | 'price_desc' | 'newest'),
    page: Number(req.query['page']),
    limit: Number(req.query['limit']),
  });

  res.status(200).json({
    success: true,
    message: 'Search results',
    data: result.listings,
    pagination: result.pagination,
  });
});

export const searchSuggestions = asyncHandler(async (req: Request, res: Response) => {
  const suggestions = await searchSuggestionsService(req.query['q'] as string);

  res.status(200).json({
    success: true,
    message: 'Search suggestions',
    data: suggestions,
  });
});
