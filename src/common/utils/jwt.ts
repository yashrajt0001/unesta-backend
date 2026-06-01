import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

interface AccessTokenPayload {
  userId: string;
  type: 'access';
}

interface AdminAccessTokenPayload {
  adminId: string;
  type: 'admin_access';
}

export const generateAccessToken = (userId: string): string => {
  return jwt.sign(
    { userId, type: 'access' } satisfies AccessTokenPayload,
    env.JWT_ACCESS_SECRET,
  );
};

export const generateAdminAccessToken = (adminId: string): string => {
  return jwt.sign(
    { adminId, type: 'admin_access' } satisfies AdminAccessTokenPayload,
    env.JWT_ACCESS_SECRET,
  );
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
};

export const verifyAdminAccessToken = (token: string): AdminAccessTokenPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AdminAccessTokenPayload;
};
