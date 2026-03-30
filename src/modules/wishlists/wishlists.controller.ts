import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/types/index.js';
import {
  getWishlistsService,
  getWishlistService,
  createWishlistService,
  updateWishlistService,
  deleteWishlistService,
  addItemService,
  removeItemService,
} from './wishlists.service.js';

export const getWishlists = asyncHandler(async (req: Request, res: Response) => {
  const data = await getWishlistsService(req.user!.userId);
  res.status(200).json({ success: true, message: 'Wishlists retrieved', data });
});

export const getWishlist = asyncHandler(async (req: Request, res: Response) => {
  const data = await getWishlistService(req.params['id'] as string, req.user!.userId);
  res.status(200).json({ success: true, message: 'Wishlist retrieved', data });
});

export const createWishlist = asyncHandler(async (req: Request, res: Response) => {
  const data = await createWishlistService(req.user!.userId, req.body.name);
  res.status(201).json({ success: true, message: 'Wishlist created', data });
});

export const updateWishlist = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateWishlistService(req.params['id'] as string, req.user!.userId, req.body.name);
  res.status(200).json({ success: true, message: 'Wishlist updated', data });
});

export const deleteWishlist = asyncHandler(async (req: Request, res: Response) => {
  await deleteWishlistService(req.params['id'] as string, req.user!.userId);
  res.status(200).json({ success: true, message: 'Wishlist deleted' });
});

export const addItem = asyncHandler(async (req: Request, res: Response) => {
  const data = await addItemService(req.params['id'] as string, req.user!.userId, req.body.listingId, req.body.note);
  res.status(201).json({ success: true, message: 'Listing added to wishlist', data });
});

export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  await removeItemService(req.params['id'] as string, req.user!.userId, req.params['listingId'] as string);
  res.status(200).json({ success: true, message: 'Listing removed from wishlist' });
});
