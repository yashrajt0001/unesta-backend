import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/types/index.js';
import {
  getHostOverviewService,
  getHostEarningsService,
  getHostAnalyticsService,
} from './host.service.js';

export const getHostOverview = asyncHandler(async (req: Request, res: Response) => {
  const data = await getHostOverviewService(req.user!.userId);
  res.status(200).json({ success: true, message: 'Host overview retrieved', data });
});

export const getHostEarnings = asyncHandler(async (req: Request, res: Response) => {
  const { from, to, listingId } = req.query as Record<string, string | undefined>;

  // Default: current month
  const now = new Date();
  const fromDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const toDate = to ? new Date(to) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const data = await getHostEarningsService(req.user!.userId, fromDate, toDate, listingId);
  res.status(200).json({ success: true, message: 'Earnings retrieved', data });
});

export const getHostAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { listingId } = req.query as Record<string, string | undefined>;
  const data = await getHostAnalyticsService(req.user!.userId, listingId);
  res.status(200).json({ success: true, message: 'Analytics retrieved', data });
});
