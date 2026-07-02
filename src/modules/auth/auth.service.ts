import { prisma } from '../../common/config/database.js';
import { generateAccessToken } from '../../common/utils/jwt.js';
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
