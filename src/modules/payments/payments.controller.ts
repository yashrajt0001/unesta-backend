import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/types/index.js';
import {
  getPaymentByIdService,
  getMyPaymentsService,
  getMyPayoutsService,
  addPayoutMethodService,
  getPayoutMethodsService,
  deletePayoutMethodService,
} from './payments.service.js';
import type { PaymentStatus, PayoutStatus } from '@prisma/client';

export const getPaymentById = asyncHandler(async (req: Request, res: Response) => {
  const payment = await getPaymentByIdService(req.params['id'] as string, req.user!.userId);
  res.status(200).json({ success: true, message: 'Payment retrieved', data: payment });
});

export const getMyPayments = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query['page']);
  const limit = Number(req.query['limit']);
  const status = req.query['status'] as PaymentStatus | undefined;
  const result = await getMyPaymentsService(req.user!.userId, page, limit, status);
  res.status(200).json({ success: true, message: 'Payments retrieved', data: result.payments, pagination: result.pagination });
});

export const getMyPayouts = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query['page']);
  const limit = Number(req.query['limit']);
  const status = req.query['status'] as PayoutStatus | undefined;
  const result = await getMyPayoutsService(req.user!.userId, page, limit, status);
  res.status(200).json({ success: true, message: 'Payouts retrieved', data: result.payouts, pagination: result.pagination });
});

export const addPayoutMethod = asyncHandler(async (req: Request, res: Response) => {
  const method = await addPayoutMethodService(req.user!.userId, req.body);
  res.status(201).json({ success: true, message: 'Payout method added', data: method });
});

export const getPayoutMethods = asyncHandler(async (req: Request, res: Response) => {
  const methods = await getPayoutMethodsService(req.user!.userId);
  res.status(200).json({ success: true, message: 'Payout methods retrieved', data: methods });
});

export const deletePayoutMethod = asyncHandler(async (req: Request, res: Response) => {
  const result = await deletePayoutMethodService(req.params['id'] as string, req.user!.userId);
  res.status(200).json({ success: true, ...result });
});
