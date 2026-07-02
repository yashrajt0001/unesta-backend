import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string(),
  JWT_ACCESS_SECRET: z.string().min(16),
  CLOUDINARY_URL: z.string().optional(),
  WEB_APP_URL: z.string().default('http://localhost:3000'),
  HOST_APP_URL: z.string().default('http://localhost:3001'),
  ADMIN_APP_URL: z.string().default('http://localhost:3002'),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(10),
  GOOGLE_MAPS_SERVER_KEY: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
