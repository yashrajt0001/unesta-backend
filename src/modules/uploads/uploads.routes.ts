import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import { authenticateUser } from '../../common/middleware/auth.middleware.js';
import { presignUpload } from './uploads.controller.js';
import { presignUploadSchema } from './uploads.validation.js';

const router = Router();

router.post('/presign', authenticateUser, validate(presignUploadSchema), presignUpload);

export default router;
