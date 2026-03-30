import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CLOUDINARY_URL: z.string().optional(),
  WEB_APP_URL: z.string().default('http://localhost:3000'),
  HOST_APP_URL: z.string().default('http://localhost:3001'),
  ADMIN_APP_URL: z.string().default('http://localhost:3002'),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(10),
});

export const env = envSchema.parse(process.env);
