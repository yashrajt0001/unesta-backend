import { OAuth2Client } from 'google-auth-library';
import type { User } from '@prisma/client';
import { prisma } from '../../common/config/database.js';
import { env } from '../../common/config/env.js';
import { generateAccessToken } from '../../common/utils/jwt.js';
import { storeOtp, verifyOtp } from '../../common/utils/otp.js';
import { AppError } from '../../common/middleware/error-handler.js';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export const sendOtpService = async (phone: string) => {
  await storeOtp(phone);
  return { message: 'OTP sent successfully' };
};

export const verifyOtpService = async (phone: string, otp: string) => {
  const isValid = await verifyOtp(phone, otp);
  if (!isValid) {
    throw new AppError('Invalid or expired OTP', 401);
  }

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

  const accessToken = generateAccessToken(user.id);

  return { user, accessToken, isNewUser };
};

export const googleAuthService = async (idToken: string) => {
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AppError('Invalid Google ID token', 401);
  }

  if (!payload || !payload.sub) {
    throw new AppError('Invalid Google ID token', 401);
  }

  const { sub, email, email_verified, given_name, family_name, picture } = payload;

  if (!email || !email_verified) {
    throw new AppError('Google email not verified', 401);
  }

  const googleData = {
    googleId: sub,
    email,
    firstName: given_name ?? null,
    lastName: family_name ?? null,
    avatarUrl: picture ?? null,
  };

  // 1. Existing Google account — refresh stored snapshot, return its user
  const existingGoogleAccount = await prisma.googleAccount.findUnique({
    where: { googleId: sub },
    include: { user: true },
  });

  if (existingGoogleAccount) {
    await prisma.googleAccount.update({
      where: { id: existingGoogleAccount.id },
      data: {
        email: googleData.email,
        firstName: googleData.firstName,
        lastName: googleData.lastName,
        avatarUrl: googleData.avatarUrl,
      },
    });
    const accessToken = generateAccessToken(existingGoogleAccount.user.id);
    return { user: existingGoogleAccount.user, accessToken, isNewUser: false };
  }

  // 2. Existing user by email (created via phone OTP) — link Google, backfill null fields only
  let user: User | null = await prisma.user.findUnique({ where: { email } });

  if (user) {
    await prisma.googleAccount.create({
      data: { ...googleData, userId: user.id },
    });

    const backfill: Partial<{ firstName: string; lastName: string; avatarUrl: string }> = {};
    if (!user.firstName && given_name) backfill.firstName = given_name;
    if (!user.lastName && family_name) backfill.lastName = family_name;
    if (!user.avatarUrl && picture) backfill.avatarUrl = picture;

    if (Object.keys(backfill).length > 0) {
      user = await prisma.user.update({ where: { id: user.id }, data: backfill });
    }

    const accessToken = generateAccessToken(user.id);
    return { user, accessToken, isNewUser: false };
  }

  // 3. Brand new — create User seeded from Google data + GoogleAccount snapshot
  user = await prisma.user.create({
    data: {
      email,
      firstName: given_name ?? null,
      lastName: family_name ?? null,
      avatarUrl: picture ?? null,
      role: 'GUEST',
      googleAccount: { create: googleData },
    },
  });

  const accessToken = generateAccessToken(user.id);
  return { user, accessToken, isNewUser: true };
};
