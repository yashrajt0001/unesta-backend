import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/types/index.js';
import {
  submitReportService,
  getMyReportsService,
  adminListReportsService,
  adminUpdateReportService,
} from './reports.service.js';

export const submitReport = asyncHandler(async (req: Request, res: Response) => {
  const report = await submitReportService(req.user!.userId, req.body);
  res.status(201).json({ success: true, message: 'Report submitted', data: report });
});

export const getMyReports = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query['page']);
  const limit = Number(req.query['limit']);
  const result = await getMyReportsService(req.user!.userId, page, limit);
  res.status(200).json({ success: true, message: 'Reports retrieved', data: result.reports, pagination: result.pagination });
});

export const adminListReports = asyncHandler(async (req: Request, res: Response) => {
  const { status, reason, page, limit } = req.query as Record<string, string>;
  const result = await adminListReportsService(status as any, reason as any, Number(page), Number(limit));
  res.status(200).json({ success: true, message: 'Reports retrieved', data: result.reports, pagination: result.pagination });
});

export const adminUpdateReport = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminUpdateReportService(
    req.params['id'] as string,
    req.admin!.adminId,
    req.body.status,
    req.body.adminNotes,
  );
  res.status(200).json({ success: true, message: 'Report updated', data: result });
});
