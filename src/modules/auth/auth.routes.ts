import { Router } from 'express';
import { sendOtp, verifyOtpController, refreshToken, logout } from './auth.controller.js';
import { validate } from '../../common/middleware/validate.js';
import { authenticateUser } from '../../common/middleware/auth.middleware.js';
import { authRateLimiter } from '../../common/middleware/rate-limiter.js';
import { sendOtpSchema, verifyOtpSchema, refreshTokenSchema } from './auth.validation.js';

const router = Router();

router.post('/send-otp', authRateLimiter, validate(sendOtpSchema), sendOtp);
router.post('/verify-otp', authRateLimiter, validate(verifyOtpSchema), verifyOtpController);
router.post('/refresh-token', validate(refreshTokenSchema), refreshToken);
router.post('/logout', authenticateUser, logout);

export default router;
