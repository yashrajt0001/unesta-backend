import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2, R2_BUCKET } from '../config/r2.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error-handler.js';
import { logger } from './logger.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export const ALLOWED_IMAGE_TYPES = Object.keys(EXTENSION_BY_TYPE) as [string, ...string[]];

export type UploadFolder = 'listings' | 'avatars';

const PUBLIC_BASE = env.R2_PUBLIC_URL.replace(/\/+$/, '');

export const publicUrl = (key: string) => `${PUBLIC_BASE}/${key}`;

export const keyFromPublicUrl = (url: string) =>
  url.startsWith(`${PUBLIC_BASE}/`) ? url.slice(PUBLIC_BASE.length + 1) : null;

// The key is minted here, never taken from the client, and is namespaced by the
// uploader so the step that saves it can prove the caller owns it.
export const isOwnedKey = (key: string, folder: UploadFolder, ownerId: string) =>
  new RegExp(
    `^${folder}/${ownerId}/[0-9a-f-]{36}\.(${Object.values(EXTENSION_BY_TYPE).join('|')})$`,
  ).test(key);

// Presigned PUT: the browser sends the bytes straight to R2, so image data never
// passes through the API. Content type and length are part of the signature, so
// the URL cannot be reused to upload something bigger or of another type.
export const createPresignedUpload = async (
  folder: UploadFolder,
  ownerId: string,
  contentType: string,
  size: number,
) => {
  const extension = EXTENSION_BY_TYPE[contentType];
  if (!extension) throw new AppError('Unsupported image type', 400);

  const key = `${folder}/${ownerId}/${randomUUID()}.${extension}`;

  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    }),
    { expiresIn: 300 },
  );

  return { uploadUrl, key, publicUrl: publicUrl(key) };
};

// Confirms the client actually finished the upload before we persist a row that
// points at the object.
export const assertObjectExists = async (key: string) => {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch {
    throw new AppError('Upload not found — upload the file before saving it', 400);
  }
};

// Best effort: a failed delete must not fail the request that owns it, the
// object is just left behind in the bucket.
export const deleteObject = async (key: string) => {
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch (error) {
    logger.error({ err: error, key }, 'Failed to delete R2 object');
  }
};

export const deleteObjectsByUrl = async (urls: string[]) => {
  const keys = urls.map(keyFromPublicUrl).filter((key): key is string => key !== null);
  await Promise.all(keys.map(deleteObject));
};
