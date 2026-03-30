import type { Request, Response } from 'express';
import {
  createListingService,
  getListingByIdService,
  getMyListingsService,
  updateListingService,
  updateListingStatusService,
  deleteListingService,
  addHouseRulesService,
  deleteHouseRuleService,
  updateAvailabilityService,
  getAvailabilityService,
  getAllAmenitiesService,
  addListingImageService,
  deleteListingImageService,
  setCoverImageService,
} from './listings.service.js';
import { asyncHandler } from '../../common/types/index.js';
import { uploadToCloudinary } from '../../common/utils/upload.js';
import { AppError } from '../../common/middleware/error-handler.js';
import type { ListingStatus } from '@prisma/client';

export const createListing = asyncHandler(async (req: Request, res: Response) => {
  const listing = await createListingService(req.user!.userId, req.body);
  res.status(201).json({ success: true, message: 'Listing created successfully', data: listing });
});

export const getListingById = asyncHandler(async (req: Request, res: Response) => {
  const listing = await getListingByIdService(req.params['id'] as string, req.user?.userId);
  res.status(200).json({ success: true, message: 'Listing retrieved successfully', data: listing });
});

export const getMyListings = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query['page']);
  const limit = Number(req.query['limit']);
  const status = req.query['status'] as ListingStatus | undefined;
  const result = await getMyListingsService(req.user!.userId, page, limit, status);
  res.status(200).json({ success: true, message: 'Listings retrieved successfully', ...result });
});

export const updateListing = asyncHandler(async (req: Request, res: Response) => {
  const listing = await updateListingService(req.params['id'] as string, req.user!.userId, req.body);
  res.status(200).json({ success: true, message: 'Listing updated successfully', data: listing });
});

export const updateListingStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as { status: 'PUBLISHED' | 'UNLISTED' };
  const result = await updateListingStatusService(req.params['id'] as string, req.user!.userId, status);
  res.status(200).json({ success: true, message: `Listing ${status.toLowerCase()} successfully`, data: result });
});

export const deleteListing = asyncHandler(async (req: Request, res: Response) => {
  const result = await deleteListingService(req.params['id'] as string, req.user!.userId);
  res.status(200).json({ success: true, ...result });
});

export const addHouseRules = asyncHandler(async (req: Request, res: Response) => {
  const rules = await addHouseRulesService(req.params['id'] as string, req.user!.userId, req.body.rules);
  res.status(200).json({ success: true, message: 'House rules updated', data: rules });
});

export const deleteHouseRule = asyncHandler(async (req: Request, res: Response) => {
  const result = await deleteHouseRuleService(
    req.params['id'] as string,
    req.params['ruleId'] as string,
    req.user!.userId,
  );
  res.status(200).json({ success: true, ...result });
});

export const updateAvailability = asyncHandler(async (req: Request, res: Response) => {
  const result = await updateAvailabilityService(req.params['id'] as string, req.user!.userId, req.body.dates);
  res.status(200).json({ success: true, ...result });
});

export const getAvailability = asyncHandler(async (req: Request, res: Response) => {
  const from = req.query['from'] as string;
  const to = req.query['to'] as string;
  const availability = await getAvailabilityService(req.params['id'] as string, from, to);
  res.status(200).json({ success: true, message: 'Availability retrieved', data: availability });
});

export const addListingImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError('Image file is required', 400);
  const url = await uploadToCloudinary(req.file.buffer, 'listings');
  const isCover = req.body.isCover === 'true';
  const image = await addListingImageService(req.params['id'] as string, req.user!.userId, url, isCover);
  res.status(201).json({ success: true, message: 'Image uploaded', data: image });
});

export const deleteListingImage = asyncHandler(async (req: Request, res: Response) => {
  const result = await deleteListingImageService(
    req.params['id'] as string,
    req.params['imageId'] as string,
    req.user!.userId,
  );
  res.status(200).json({ success: true, ...result });
});

export const setCoverImage = asyncHandler(async (req: Request, res: Response) => {
  const result = await setCoverImageService(
    req.params['id'] as string,
    req.params['imageId'] as string,
    req.user!.userId,
  );
  res.status(200).json({ success: true, ...result });
});

export const getAllAmenities = asyncHandler(async (_req: Request, res: Response) => {
  const amenities = await getAllAmenitiesService();
  res.status(200).json({ success: true, message: 'Amenities retrieved', data: amenities });
});
