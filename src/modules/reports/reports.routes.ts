import { Router } from 'express';
import { authenticateUser, authenticateAdmin } from '../../common/middleware/auth.middleware.js';
import { validate } from '../../common/middleware/validate.js';
import { submitReport, getMyReports, adminListReports, adminUpdateReport } from './reports.controller.js';
import {
  submitReportSchema,
  myReportsSchema,
  adminListReportsSchema,
  adminUpdateReportSchema,
} from './reports.validation.js';

const router = Router();

// User routes
router.post('/', authenticateUser, validate(submitReportSchema), submitReport);
router.get('/my', authenticateUser, validate(myReportsSchema), getMyReports);

// Admin routes
router.get('/admin', authenticateAdmin, validate(adminListReportsSchema), adminListReports);
router.patch('/admin/:id', authenticateAdmin, validate(adminUpdateReportSchema), adminUpdateReport);

export default router;
