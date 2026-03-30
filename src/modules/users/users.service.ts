import { prisma } from '../../common/config/database.js';
import { AppError } from '../../common/middleware/error-handler.js';

export const getProfileService = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return user;
};

export const updateProfileService = async (
  userId: string,
  data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    dateOfBirth?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
    bio?: string;
  },
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // If email is being changed, check uniqueness
  if (data.email && data.email !== user.email) {
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      throw new AppError('Email already in use', 409);
    }
  }

  const updateData: Record<string, unknown> = { ...data };
  if (data.dateOfBirth) {
    updateData.dateOfBirth = new Date(data.dateOfBirth);
  }

  return prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
};

export const updateAvatarService = async (userId: string, avatarUrl: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  return prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
  });
};

export const deleteAccountService = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Revoke all refresh tokens
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { isRevoked: true },
  });

  // Delete user (cascade will handle refresh tokens)
  await prisma.user.delete({ where: { id: userId } });

  return { message: 'Account deleted successfully' };
};
