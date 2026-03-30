import { Router } from 'express';
import { authenticateAdmin } from '../../common/middleware/auth.middleware.js';
import { authRateLimiter } from '../../common/middleware/rate-limiter.js';
import { validate } from '../../common/middleware/validate.js';
import {
  adminLogin,
  getAdminProfile,
  getAdminStats,
  listUsers,
  suspendUser,
  reactivateUser,
  listListingsAdmin,
  suspendListing,
  unsuspendListing,
  listBookingsAdmin,
  getFinancialSummary,
  listPaymentsAdmin,
  listPayoutsAdmin,
  listModerators,
  createModerator,
  updateModerator,
  deleteModerator,
  listRoles,
  listReviewsAdmin,
  deleteReview,
  toggleReviewVisibility,
  getUserDetail,
  getListingDetail,
  getBookingDetail,
  changePassword,
} from './admin.controller.js';
import {
  adminLoginSchema,
  listUsersSchema,
  listListingsSchema,
  adminUserIdParamSchema,
  adminListingIdParamSchema,
  listBookingsAdminSchema,
  listPaymentsAdminSchema,
  listPayoutsAdminSchema,
  createModeratorSchema,
  updateModeratorSchema,
  moderatorIdParamSchema,
  listReviewsAdminSchema,
  reviewIdParamSchema,
  adminUserDetailSchema,
  adminListingDetailSchema,
  adminBookingDetailSchema,
  changePasswordSchema,
} from './admin.validation.js';

const router = Router();

// Public
router.post('/login', authRateLimiter, validate(adminLoginSchema), adminLogin);

// Authenticated
router.use(authenticateAdmin);
router.get('/me', getAdminProfile);
router.patch('/change-password', validate(changePasswordSchema), changePassword);
router.get('/stats', getAdminStats);

// Moderator Management
router.get('/moderators', listModerators);
router.post('/moderators', validate(createModeratorSchema), createModerator);
router.patch('/moderators/:id', validate(updateModeratorSchema), updateModerator);
router.delete('/moderators/:id', validate(moderatorIdParamSchema), deleteModerator);
router.get('/roles', listRoles);

// Users
router.get('/users', validate(listUsersSchema), listUsers);
router.get('/users/:id', validate(adminUserDetailSchema), getUserDetail);
router.patch('/users/:id/suspend', validate(adminUserIdParamSchema), suspendUser);
router.patch('/users/:id/reactivate', validate(adminUserIdParamSchema), reactivateUser);

// Listings
router.get('/listings', validate(listListingsSchema), listListingsAdmin);
router.get('/listings/:id', validate(adminListingDetailSchema), getListingDetail);
router.patch('/listings/:id/suspend', validate(adminListingIdParamSchema), suspendListing);
router.patch('/listings/:id/unsuspend', validate(adminListingIdParamSchema), unsuspendListing);

// Bookings
router.get('/bookings', validate(listBookingsAdminSchema), listBookingsAdmin);
router.get('/bookings/:id', validate(adminBookingDetailSchema), getBookingDetail);

// Reviews
router.get('/reviews', validate(listReviewsAdminSchema), listReviewsAdmin);
router.delete('/reviews/:id', validate(reviewIdParamSchema), deleteReview);
router.patch('/reviews/:id/toggle-visibility', validate(reviewIdParamSchema), toggleReviewVisibility);

// Financials
router.get('/financials', getFinancialSummary);
router.get('/payments', validate(listPaymentsAdminSchema), listPaymentsAdmin);
router.get('/payouts', validate(listPayoutsAdminSchema), listPayoutsAdmin);

export default router;
