import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string(),
  JWT_ACCESS_SECRET: z.string().min(16),
  // Cloudflare R2 (S3-compatible object storage)
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  // Public read origin for the bucket — a custom domain in production, the
  // pub-*.r2.dev subdomain in development. No trailing slash.
  R2_PUBLIC_URL: z.string().url(),
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
