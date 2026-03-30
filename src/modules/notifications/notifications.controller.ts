import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/types/index.js';
import {
  listNotificationsService,
  getUnreadCountService,
  markAsReadService,
  markAllAsReadService,
} from './notifications.service.js';

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const unreadOnly = req.query['unreadOnly'] === 'true';
  const page = Number(req.query['page']);
  const limit = Number(req.query['limit']);
  const result = await listNotificationsService(req.user!.userId, unreadOnly, page, limit);
  res.status(200).json({ success: true, message: 'Notifications retrieved', data: result.notifications, pagination: result.pagination });
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const result = await getUnreadCountService(req.user!.userId);
  res.status(200).json({ success: true, message: 'Unread count retrieved', data: result });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const result = await markAsReadService(req.params['id'] as string, req.user!.userId);
  res.status(200).json({ success: true, message: 'Notification marked as read', data: result });
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const result = await markAllAsReadService(req.user!.userId);
  res.status(200).json({ success: true, message: 'All notifications marked as read', data: result });
});
