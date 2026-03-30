import { Router } from 'express';
import { authenticateUser } from '../../common/middleware/auth.middleware.js';
import { validate } from '../../common/middleware/validate.js';
import {
  createBooking,
  getBookingById,
  acceptBooking,
  declineBooking,
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  getMyBookings,
  getPriceBreakdown,
  checkAvailability,
} from './bookings.controller.js';
import {
  createBookingSchema,
  bookingIdParamSchema,
  declineBookingSchema,
  cancelBookingSchema,
  getMyBookingsSchema,
  priceBreakdownSchema,
  checkAvailabilitySchema,
} from './bookings.validation.js';

const router = Router();

// ─── Public ───────────────────────────────────────────────────────────────────
router.get('/check-availability', validate(checkAvailabilitySchema), checkAvailability);
router.get('/price-breakdown', validate(priceBreakdownSchema), getPriceBreakdown);

// ─── Authenticated ────────────────────────────────────────────────────────────
router.use(authenticateUser);

router.post('/', validate(createBookingSchema), createBooking);
router.get('/', validate(getMyBookingsSchema), getMyBookings);
router.get('/:id', validate(bookingIdParamSchema), getBookingById);

router.patch('/:id/accept', validate(bookingIdParamSchema), acceptBooking);
router.patch('/:id/decline', validate(declineBookingSchema), declineBooking);
router.patch('/:id/cancel', validate(cancelBookingSchema), cancelBooking);

router.post('/:id/check-in', validate(bookingIdParamSchema), checkInBooking);
router.post('/:id/check-out', validate(bookingIdParamSchema), checkOutBooking);

export default router;
