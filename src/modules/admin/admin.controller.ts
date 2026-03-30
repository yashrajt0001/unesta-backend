import type { Request, Response } from 'express';
import {
  adminLoginService,
  getAdminProfileService,
  getAdminStatsService,
  listUsersService,
  suspendUserService,
  reactivateUserService,
  listListingsAdminService,
  suspendListingService,
  unsuspendListingService,
  listBookingsAdminService,
  getFinancialSummaryService,
  listPaymentsAdminService,
  listPayoutsAdminService,
  listModeratorsService,
  createModeratorService,
  updateModeratorService,
  deleteModeratorService,
  listRolesService,
  listReviewsAdminService,
  deleteReviewService,
  toggleReviewVisibilityService,
  getUserDetailService,
  getListingDetailService,
  getBookingDetailService,
  changePasswordService,
} from './admin.service.js';
import { asyncHandler } from '../../common/types/index.js';

export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await adminLoginService(email, password);
  res.status(200).json({ success: true, message: 'Login successful', data: result });
});

export const getAdminProfile = asyncHandler(async (req: Request, res: Response) => {
  const admin = await getAdminProfileService(req.admin!.adminId);
  res.status(200).json({ success: true, message: 'Profile fetched', data: admin });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  await changePasswordService(req.admin!.adminId, currentPassword, newPassword);
  res.status(200).json({ success: true, message: 'Password changed successfully' });
});

export const getAdminStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await getAdminStatsService();
  res.status(200).json({ success: true, message: 'Stats retrieved', data: stats });
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { search, role, isSuspended, page, limit } = req.query as Record<string, string>;
  const result = await listUsersService(
    search,
    role as any,
    isSuspended !== undefined ? isSuspended === 'true' : undefined,
    Number(page),
    Number(limit),
  );
  res.status(200).json({ success: true, message: 'Users retrieved', data: result.users, pagination: result.pagination });
});

export const suspendUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await suspendUserService(req.params['id'] as string);
  res.status(200).json({ success: true, message: 'User suspended', data: result });
});

export const reactivateUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await reactivateUserService(req.params['id'] as string);
  res.status(200).json({ success: true, message: 'User reactivated', data: result });
});

export const listListingsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { search, status, page, limit } = req.query as Record<string, string>;
  const result = await listListingsAdminService(search, status, Number(page), Number(limit));
  res.status(200).json({ success: true, message: 'Listings retrieved', data: result.listings, pagination: result.pagination });
});

export const suspendListing = asyncHandler(async (req: Request, res: Response) => {
  const result = await suspendListingService(req.params['id'] as string);
  res.status(200).json({ success: true, message: 'Listing suspended', data: result });
});

export const unsuspendListing = asyncHandler(async (req: Request, res: Response) => {
  const result = await unsuspendListingService(req.params['id'] as string);
  res.status(200).json({ success: true, message: 'Listing unsuspended', data: result });
});

export const listBookingsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { search, status, page, limit } = req.query as Record<string, string>;
  const result = await listBookingsAdminService(search, status, Number(page), Number(limit));
  res.status(200).json({ success: true, message: 'Bookings retrieved', data: result.bookings, pagination: result.pagination });
});

export const getFinancialSummary = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await getFinancialSummaryService();
  res.status(200).json({ success: true, message: 'Financial summary retrieved', data: summary });
});

export const listPaymentsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as Record<string, string>;
  const result = await listPaymentsAdminService(status, Number(page), Number(limit));
  res.status(200).json({ success: true, message: 'Payments retrieved', data: result.payments, pagination: result.pagination });
});

export const listPayoutsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as Record<string, string>;
  const result = await listPayoutsAdminService(status, Number(page), Number(limit));
  res.status(200).json({ success: true, message: 'Payouts retrieved', data: result.payouts, pagination: result.pagination });
});

// ─── Moderator Management ────────────────────────────────────────────────────

export const listModerators = asyncHandler(async (_req: Request, res: Response) => {
  const moderators = await listModeratorsService();
  res.status(200).json({ success: true, message: 'Moderators retrieved', data: moderators });
});

export const createModerator = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, roleIds } = req.body;
  const moderator = await createModeratorService(email, password, roleIds);
  res.status(201).json({ success: true, message: 'Moderator created', data: moderator });
});

export const updateModerator = asyncHandler(async (req: Request, res: Response) => {
  const moderator = await updateModeratorService(req.params['id'] as string, req.body);
  res.status(200).json({ success: true, message: 'Moderator updated', data: moderator });
});

export const deleteModerator = asyncHandler(async (req: Request, res: Response) => {
  await deleteModeratorService(req.params['id'] as string, req.admin!.adminId);
  res.status(200).json({ success: true, message: 'Moderator deleted' });
});

export const listRoles = asyncHandler(async (_req: Request, res: Response) => {
  const roles = await listRolesService();
  res.status(200).json({ success: true, message: 'Roles retrieved', data: roles });
});

// ─── Review Moderation ───────────────────────────────────────────────────────

export const listReviewsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { search, isPublic, type, page, limit } = req.query as Record<string, string>;
  const result = await listReviewsAdminService(
    search,
    isPublic !== undefined ? isPublic === 'true' : undefined,
    type,
    Number(page),
    Number(limit),
  );
  res.status(200).json({ success: true, message: 'Reviews retrieved', data: result.reviews, pagination: result.pagination });
});

export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  await deleteReviewService(req.params['id'] as string);
  res.status(200).json({ success: true, message: 'Review deleted' });
});

export const toggleReviewVisibility = asyncHandler(async (req: Request, res: Response) => {
  const result = await toggleReviewVisibilityService(req.params['id'] as string);
  res.status(200).json({ success: true, message: `Review ${result.isPublic ? 'published' : 'hidden'}`, data: result });
});

// ─── Detail Views ────────────────────────────────────────────────────────────

export const getUserDetail = asyncHandler(async (req: Request, res: Response) => {
  const user = await getUserDetailService(req.params['id'] as string);
  res.status(200).json({ success: true, message: 'User details retrieved', data: user });
});

export const getListingDetail = asyncHandler(async (req: Request, res: Response) => {
  const listing = await getListingDetailService(req.params['id'] as string);
  res.status(200).json({ success: true, message: 'Listing details retrieved', data: listing });
});

export const getBookingDetail = asyncHandler(async (req: Request, res: Response) => {
  const booking = await getBookingDetailService(req.params['id'] as string);
  res.status(200).json({ success: true, message: 'Booking details retrieved', data: booking });
});
