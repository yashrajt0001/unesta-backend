import { z } from 'zod';

export const sendOtpSchema = z.object({
  body: z.object({
    phone: z
      .string()
      .min(10, 'Phone number must be at least 10 characters')
      .max(15, 'Phone number must be at most 15 characters'),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: z
      .string()
      .min(10, 'Phone number must be at least 10 characters')
      .max(15, 'Phone number must be at most 15 characters'),
    otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  }),
});

export const googleAuthSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, 'idToken is required'),
  }),
});
