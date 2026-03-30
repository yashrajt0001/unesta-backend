import crypto from 'crypto';
import { prisma } from '../../common/config/database.js';
import { env } from '../../common/config/env.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../common/utils/jwt.js';
import { storeOtp, verifyOtp } from '../../common/utils/otp.js';
import { AppError } from '../../common/middleware/error-handler.js';

export const sendOtpService = async (phone: string) => {
  await storeOtp(phone);
  return { message: 'OTP sent successfully' };
};

export const verifyOtpService = async (phone: string, otp: string) => {
  const isValid = await verifyOtp(phone, otp);
  if (!isValid) {
    throw new AppError('Invalid or expired OTP', 401);
  }

  // Find or create user
  let user = await prisma.user.findUnique({ where: { phone } });
  let isNewUser = false;

  if (!user) {
    user = await prisma.user.create({
      data: {
        phone,
        isPhoneVerified: true,
        role: 'GUEST',
      },
    });
    isNewUser = true;
  } else if (!user.isPhoneVerified) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { isPhoneVerified: true },
    });
  }

  // Generate tokens
  const tokenId = crypto.randomUUID();
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id, tokenId);

  // Calculate refresh token expiry
  const refreshExpiryMs = parseDuration(env.JWT_REFRESH_EXPIRES_IN);
  const expiresAt = new Date(Date.now() + refreshExpiryMs);

  // Store refresh token
  await prisma.refreshToken.create({
    data: {
      id: tokenId,
      token: refreshToken,
      userId: user.id,
      expiresAt,
    },
  });

  return {
    user,
    accessToken,
    refreshToken,
    isNewUser,
  };
};

export const refreshTokenService = async (token: string) => {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }

  if (payload.type !== 'refresh') {
    throw new AppError('Invalid token type', 401);
  }

  // Find token in DB
  const storedToken = await prisma.refreshToken.findUnique({
    where: { id: payload.tokenId },
  });

  if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
    throw new AppError('Refresh token expired or revoked', 401);
  }

  // Revoke old token (rotation)
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { isRevoked: true },
  });

  // Issue new token pair
  const newTokenId = crypto.randomUUID();
  const accessToken = generateAccessToken(payload.userId);
  const refreshToken = generateRefreshToken(payload.userId, newTokenId);

  const refreshExpiryMs = parseDuration(env.JWT_REFRESH_EXPIRES_IN);
  const expiresAt = new Date(Date.now() + refreshExpiryMs);

  await prisma.refreshToken.create({
    data: {
      id: newTokenId,
      token: refreshToken,
      userId: payload.userId,
      expiresAt,
    },
  });

  return { accessToken, refreshToken };
};

export const logoutService = async (refreshToken: string) => {
  // Revoke the refresh token
  const token = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (token && !token.isRevoked) {
    await prisma.refreshToken.update({
      where: { id: token.id },
      data: { isRevoked: true },
    });
  }

  return { message: 'Logged out successfully' };
};

// Helper: parse duration strings like "7d", "15m", "1h" to milliseconds
const parseDuration = (duration: string): number => {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
};
