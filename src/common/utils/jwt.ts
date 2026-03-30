import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

interface AccessTokenPayload {
  userId: string;
  type: 'access';
}

interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  type: 'refresh';
}

interface AdminAccessTokenPayload {
  adminId: string;
  type: 'admin_access';
}

const accessOptions: SignOptions = {
  expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
};

const refreshOptions: SignOptions = {
  expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
};

export const generateAccessToken = (userId: string): string => {
  return jwt.sign(
    { userId, type: 'access' } satisfies AccessTokenPayload,
    env.JWT_ACCESS_SECRET,
    accessOptions,
  );
};

export const generateRefreshToken = (userId: string, tokenId: string): string => {
  return jwt.sign(
    { userId, tokenId, type: 'refresh' } satisfies RefreshTokenPayload,
    env.JWT_REFRESH_SECRET,
    refreshOptions,
  );
};

export const generateAdminAccessToken = (adminId: string): string => {
  return jwt.sign(
    { adminId, type: 'admin_access' } satisfies AdminAccessTokenPayload,
    env.JWT_ACCESS_SECRET,
    accessOptions,
  );
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
};

export const verifyAdminAccessToken = (token: string): AdminAccessTokenPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AdminAccessTokenPayload;
};
