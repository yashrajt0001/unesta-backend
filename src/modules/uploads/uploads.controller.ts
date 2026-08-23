import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/types/index.js';
import { createPresignedUpload } from '../../common/utils/storage.js';

// Hands the client a short-lived URL to PUT one image straight into R2. There is
// no service file — the R2 calls live in common/utils/storage.ts because the
// listings module uses them too.
export const presignUpload = asyncHandler(async (req: Request, res: Response) => {
  const data = await createPresignedUpload(
    req.body.folder,
    req.user!.userId,
    req.body.contentType,
    req.body.size,
  );
  res.status(200).json({ success: true, message: 'Upload URL created', data });
});
