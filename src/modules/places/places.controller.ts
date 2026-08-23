import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/types/index.js';
import {
  autocompleteService,
  placeDetailsService,
  reverseGeocodeService,
} from './places.service.js';

export const placesAutocomplete = asyncHandler(async (req: Request, res: Response) => {
  const lat = req.query['lat'] as number | undefined;
  const lng = req.query['lng'] as number | undefined;

  const suggestions = await autocompleteService(
    req.query['input'] as string,
    req.query['sessiontoken'] as string | undefined,
    lat != null && lng != null ? { lat, lng } : undefined,
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

export const reverseGeocode = asyncHandler(async (req: Request, res: Response) => {
  const place = await reverseGeocodeService(
    req.query['lat'] as unknown as number,
    req.query['lng'] as unknown as number,
  );

  res.status(200).json({
    success: true,
    message: 'Place details',
    data: place,
  });
});
