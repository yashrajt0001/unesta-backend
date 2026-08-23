import { z } from 'zod';
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from '../../common/utils/storage.js';

export const presignUploadSchema = z.object({
  body: z.object({
    folder: z.enum(['listings', 'avatars']),
    contentType: z.enum(ALLOWED_IMAGE_TYPES, {
      errorMap: () => ({ message: 'Only JPEG, PNG, WebP and AVIF images are allowed' }),
    }),
    size: z
      .number()
      .int()
      .positive()
      .max(MAX_UPLOAD_BYTES, 'Image must be 5MB or smaller'),
  }),
});
