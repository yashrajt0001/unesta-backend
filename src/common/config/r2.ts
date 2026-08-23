import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env.js';

// R2 speaks the S3 API. `region` must be the literal "auto" and the endpoint is
// the account-scoped R2 gateway.
//
// Checksums are pinned to WHEN_REQUIRED because R2 does not implement the CRC32
// checksum headers the AWS SDK started sending by default in v3.729 — leaving
// the default breaks PutObject and every presigned upload with
// "Header 'x-amz-checksum-crc32' with value 'CRC32' not implemented".
export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

export const R2_BUCKET = env.R2_BUCKET;
