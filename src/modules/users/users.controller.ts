import type { Request, Response } from 'express';
import {
  getProfileService,
  updateProfileService,
  updateAvatarService,
  deleteAccountService,
} from './users.service.js';
import { asyncHandler } from '../../common/types/index.js';

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await getProfileService(req.user!.userId);
  res.status(200).json({ success: true, message: 'Profile fetched', data: user });
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await updateProfileService(req.user!.userId, req.body);
  res.status(200).json({ success: true, message: 'Profile updated', data: user });
});

export const updateAvatar = asyncHandler(async (req: Request, res: Response) => {
  const user = await updateAvatarService(req.user!.userId, req.body.avatarUrl);
  res.status(200).json({ success: true, message: 'Avatar updated', data: user });
});

export const deleteMe = asyncHandler(async (req: Request, res: Response) => {
  const result = await deleteAccountService(req.user!.userId);
  res.status(200).json({ success: true, ...result });
});
