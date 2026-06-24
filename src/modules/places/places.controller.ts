import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/types/index.js';
import { autocompleteService, placeDetailsService } from './places.service.js';

export const placesAutocomplete = asyncHandler(async (req: Request, res: Response) => {
  const suggestions = await autocompleteService(
    req.query['input'] as string,
    req.query['sessiontoken'] as string | undefined,
  );

  res.status(200).json({
    success: true,
    message: 'Place suggestions',
    data: suggestions,
  });
});

export const placeDetails = asyncHandler(async (req: Request, res: Response) => {
  const place = await placeDetailsService(
    req.query['place_id'] as string,
    req.query['sessiontoken'] as string | undefined,
  );

  res.status(200).json({
    success: true,
    message: 'Place details',
    data: place,
  });
});
