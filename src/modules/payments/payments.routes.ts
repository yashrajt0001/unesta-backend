import { Router } from 'express';
import { authenticateUser } from '../../common/middleware/auth.middleware.js';
import { validate } from '../../common/middleware/validate.js';
import {
  createPaymentOrder,
  verifyPayment,
  razorpayWebhook,
  getPaymentById,
  getMyPayments,
  getMyPayouts,
  addPayoutMethod,
  getPayoutMethods,
  updatePayoutMethod,
  deletePayoutMethod,
} from './payments.controller.js';
import {
  createOrderSchema,
  verifyPaymentSchema,
  getPaymentByIdSchema,
  getMyPaymentsSchema,
  getMyPayoutsSchema,
  addPayoutMethodSchema,
  payoutMethodIdParamSchema,
  updatePayoutMethodSchema,
} from './payments.validation.js';

const router = Router();

// Razorpay webhook — server-to-server, no JWT. Must be registered before the auth guard.
router.post('/payments/webhook', razorpayWebhook);

// All routes below require authentication
router.use(authenticateUser);

// Razorpay checkout (guest)
router.post('/payments/create-order', validate(createOrderSchema), createPaymentOrder);
router.post('/payments/verify', validate(verifyPaymentSchema), verifyPayment);

// Payments (guest)
router.get('/payments', validate(getMyPaymentsSchema), getMyPayments);
router.get('/payments/:id', validate(getPaymentByIdSchema), getPaymentById);

// Payouts (host)
router.get('/payouts', validate(getMyPayoutsSchema), getMyPayouts);

// Payout methods
router.post('/payout-methods', validate(addPayoutMethodSchema), addPayoutMethod);
router.get('/payout-methods', getPayoutMethods);
router.put('/payout-methods/:id', validate(updatePayoutMethodSchema), updatePayoutMethod);
router.delete('/payout-methods/:id', validate(payoutMethodIdParamSchema), deletePayoutMethod);

export default router;
