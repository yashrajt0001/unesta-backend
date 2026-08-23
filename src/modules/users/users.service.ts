import { prisma } from '../../common/config/database.js';
import { AppError } from '../../common/middleware/error-handler.js';
import {
  assertObjectExists,
  deleteObjectsByUrl,
  isOwnedKey,
  publicUrl,
} from '../../common/utils/storage.js';

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

export const updateAvatarService = async (userId: string, key: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // The key must be one we signed for this user, and the object must actually be
  // in the bucket — otherwise the row would point at nothing.
  if (!isOwnedKey(key, 'avatars', userId)) throw new AppError('Invalid upload key', 400);
  await assertObjectExists(key);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: publicUrl(key) },
  });

  // The old photo is now unreachable, so drop it from the bucket.
  if (user.avatarUrl) await deleteObjectsByUrl([user.avatarUrl]);

  return updated;
};

export const deleteAccountService = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  await prisma.user.delete({ where: { id: userId } });

  return { message: 'Account deleted successfully' };
};
