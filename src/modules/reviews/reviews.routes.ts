import { Router } from 'express';
import { authenticateUser } from '../../common/middleware/auth.middleware.js';
import { validate } from '../../common/middleware/validate.js';
import {
  getBookingReviewStatus,
  submitReview,
  getListingReviews,
  getUserReviews,
  hostResponse,
} from './reviews.controller.js';
import {
  submitReviewSchema,
  hostResponseSchema,
  listingReviewsSchema,
  userReviewsSchema,
  bookingReviewStatusSchema,
} from './reviews.validation.js';

const router = Router();

// Public routes
router.get('/reviews/listing/:listingId', validate(listingReviewsSchema), getListingReviews);
router.get('/reviews/user/:userId', validate(userReviewsSchema), getUserReviews);

// Authenticated routes
router.use(authenticateUser);
router.post('/reviews', validate(submitReviewSchema), submitReview);
router.post('/reviews/:id/response', validate(hostResponseSchema), hostResponse);
router.get('/bookings/:id/review-status', validate(bookingReviewStatusSchema), getBookingReviewStatus);

export default router;
