import { Router } from 'express';
import { authenticateUser } from '../../common/middleware/auth.middleware.js';
import { validate } from '../../common/middleware/validate.js';
import {
  getPaymentById,
  getMyPayments,
  getMyPayouts,
  addPayoutMethod,
  getPayoutMethods,
  deletePayoutMethod,
} from './payments.controller.js';
import {
  getPaymentByIdSchema,
  getMyPaymentsSchema,
  getMyPayoutsSchema,
  addPayoutMethodSchema,
  payoutMethodIdParamSchema,
} from './payments.validation.js';

const router = Router();

// All payment routes require authentication
router.use(authenticateUser);

// Payments (guest)
router.get('/payments', validate(getMyPaymentsSchema), getMyPayments);
router.get('/payments/:id', validate(getPaymentByIdSchema), getPaymentById);

// Payouts (host)
router.get('/payouts', validate(getMyPayoutsSchema), getMyPayouts);

// Payout methods
router.post('/payout-methods', validate(addPayoutMethodSchema), addPayoutMethod);
router.get('/payout-methods', getPayoutMethods);
router.delete('/payout-methods/:id', validate(payoutMethodIdParamSchema), deletePayoutMethod);

export default router;
