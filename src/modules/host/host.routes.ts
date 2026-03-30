import { Router } from 'express';
import { authenticateUser } from '../../common/middleware/auth.middleware.js';
import { validate } from '../../common/middleware/validate.js';
import { getHostOverview, getHostEarnings, getHostAnalytics } from './host.controller.js';
import { earningsQuerySchema, analyticsQuerySchema } from './host.validation.js';

const router = Router();

router.use(authenticateUser);

router.get('/overview', getHostOverview);
router.get('/earnings', validate(earningsQuerySchema), getHostEarnings);
router.get('/analytics', validate(analyticsQuerySchema), getHostAnalytics);

export default router;
