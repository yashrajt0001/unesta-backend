import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/types/index.js';
import {
  getBookingReviewStatusService,
  submitReviewService,
  getListingReviewsService,
  getUserReviewsService,
  hostResponseService,
} from './reviews.service.js';

export const getBookingReviewStatus = asyncHandler(async (req: Request, res: Response) => {
  const result = await getBookingReviewStatusService(req.params['id'] as string, req.user!.userId);
  res.status(200).json({ success: true, message: 'Review status retrieved', data: result });
});

export const submitReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await submitReviewService(req.user!.userId, req.body);
  res.status(201).json({ success: true, message: 'Review submitted', data: review });
});

export const getListingReviews = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query['page']);
  const limit = Number(req.query['limit']);
  const result = await getListingReviewsService(req.params['listingId'] as string, page, limit);
  res.status(200).json({ success: true, message: 'Listing reviews retrieved', data: result.reviews, averageRating: result.averageRating, pagination: result.pagination });
});

export const getUserReviews = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query['page']);
  const limit = Number(req.query['limit']);
  const result = await getUserReviewsService(req.params['userId'] as string, page, limit);
  res.status(200).json({ success: true, message: 'User reviews retrieved', data: result.reviews, averageRating: result.averageRating, pagination: result.pagination });
});

export const hostResponse = asyncHandler(async (req: Request, res: Response) => {
  const result = await hostResponseService(req.params['id'] as string, req.user!.userId, req.body.response);
  res.status(200).json({ success: true, message: 'Response posted', data: result });
});
