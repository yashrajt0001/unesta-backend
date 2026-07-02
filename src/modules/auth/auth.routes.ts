import { Router } from 'express';
import { sendOtp, verifyOtpController } from './auth.controller.js';
import { validate } from '../../common/middleware/validate.js';
import { authRateLimiter } from '../../common/middleware/rate-limiter.js';
import { sendOtpSchema, verifyOtpSchema } from './auth.validation.js';

const router = Router();

router.post('/send-otp', authRateLimiter, validate(sendOtpSchema), sendOtp);
router.post('/verify-otp', authRateLimiter, validate(verifyOtpSchema), verifyOtpController);

export default router;
