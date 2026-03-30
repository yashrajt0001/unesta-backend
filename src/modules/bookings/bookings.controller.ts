import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/types/index.js';
import {
  createBookingService,
  getBookingByIdService,
  acceptBookingService,
  declineBookingService,
  cancelBookingService,
  checkInBookingService,
  checkOutBookingService,
  getMyBookingsService,
  priceBreakdownService,
  checkAvailabilityService,
} from './bookings.service.js';
import type { BookingStatus } from '@prisma/client';

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await createBookingService(req.user!.userId, req.body);
  res.status(201).json({ success: true, message: 'Booking created', data: booking });
});

export const getBookingById = asyncHandler(async (req: Request, res: Response) => {
  const booking = await getBookingByIdService(req.params['id'] as string, req.user!.userId);
  res.status(200).json({ success: true, message: 'Booking retrieved', data: booking });
});

export const acceptBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await acceptBookingService(req.params['id'] as string, req.user!.userId);
  res.status(200).json({ success: true, message: 'Booking accepted', data: booking });
});

export const declineBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await declineBookingService(req.params['id'] as string, req.user!.userId, req.body.reason);
  res.status(200).json({ success: true, message: 'Booking declined', data: booking });
});

export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await cancelBookingService(req.params['id'] as string, req.user!.userId, req.body.reason);
  res.status(200).json({ success: true, message: 'Booking cancelled', data: booking });
});

export const checkInBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await checkInBookingService(req.params['id'] as string, req.user!.userId);
  res.status(200).json({ success: true, message: 'Guest checked in', data: booking });
});

export const checkOutBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await checkOutBookingService(req.params['id'] as string, req.user!.userId);
  res.status(200).json({ success: true, message: 'Guest checked out', data: booking });
});

export const getMyBookings = asyncHandler(async (req: Request, res: Response) => {
  const role = req.query['role'] as 'guest' | 'host';
  const status = req.query['status'] as BookingStatus | undefined;
  const page = Number(req.query['page']);
  const limit = Number(req.query['limit']);
  const result = await getMyBookingsService(req.user!.userId, role, page, limit, status);
  res.status(200).json({ success: true, message: 'Bookings retrieved', data: result.bookings, pagination: result.pagination });
});

export const getPriceBreakdown = asyncHandler(async (req: Request, res: Response) => {
  const breakdown = await priceBreakdownService(
    req.query['listing_id'] as string,
    req.query['check_in'] as string,
    req.query['check_out'] as string,
    Number(req.query['guests']),
  );
  res.status(200).json({ success: true, message: 'Price breakdown', data: breakdown });
});

export const checkAvailability = asyncHandler(async (req: Request, res: Response) => {
  const result = await checkAvailabilityService(
    req.query['listing_id'] as string,
    req.query['check_in'] as string,
    req.query['check_out'] as string,
  );
  res.status(200).json({ success: true, message: 'Availability checked', data: result });
});
