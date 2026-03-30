import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const generateOtp = (): string => {
 return '123456';
};

export const storeOtp = async (phone: string): Promise<string> => {
  // Delete any existing unused OTPs for this phone
  await prisma.otp.deleteMany({
    where: { phone, isUsed: false },
  });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otp.create({
    data: { phone, code, expiresAt },
  });

  // Log OTP to console in development (SMS integration later)
  if (env.NODE_ENV === 'development') {
    logger.info(`[DEV] OTP for ${phone}: ${code}`);
  }

  return code;
};

export const verifyOtp = async (phone: string, code: string): Promise<boolean> => {
  const otp = await prisma.otp.findFirst({
    where: {
      phone,
      code,
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) return false;

  // Mark OTP as used
  await prisma.otp.update({
    where: { id: otp.id },
    data: { isUsed: true },
  });

  return true;
};