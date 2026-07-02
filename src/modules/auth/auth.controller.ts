import type { Request, Response } from 'express';
import { sendOtpService, verifyOtpService } from './auth.service.js';
import { asyncHandler } from '../../common/types/index.js';

export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
  const { phone } = req.body;
  const result = await sendOtpService(phone);
  res.status(200).json({ success: true, ...result });
});

export const verifyOtpController = asyncHandler(async (req: Request, res: Response) => {
  const { phone, otp } = req.body;
  const result = await verifyOtpService(phone, otp);
  res.status(200).json({ success: true, message: 'OTP verified successfully', data: result });
});
