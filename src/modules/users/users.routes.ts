import { Router } from 'express';
import { getMe, updateMe, updateAvatar, deleteMe } from './users.controller.js';
import { validate } from '../../common/middleware/validate.js';
import { authenticateUser } from '../../common/middleware/auth.middleware.js';
import { updateProfileSchema, updateAvatarSchema } from './users.validation.js';

const router = Router();

router.use(authenticateUser);

router.get('/me', getMe);
router.put('/me', validate(updateProfileSchema), updateMe);
router.put('/me/avatar', validate(updateAvatarSchema), updateAvatar);
router.delete('/me', deleteMe);

export default router;
