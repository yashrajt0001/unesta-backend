import { z } from 'zod';

export const getPaymentByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid payment ID'),
  }),
});

export const getMyPaymentsSchema = z.object({
  query: z.object({
    status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(10),
  }),
});

export const getMyPayoutsSchema = z.object({
  query: z.object({
    status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(10),
  }),
});

export const addPayoutMethodSchema = z.object({
  body: z.object({
    methodType: z.enum(['BANK_TRANSFER', 'UPI', 'PAYPAL']),
    details: z.object({
      // BANK_TRANSFER
      accountHolderName: z.string().min(1).optional(),
      accountNumber: z.string().min(1).optional(),
      ifscCode: z.string().min(1).optional(),
      bankName: z.string().min(1).optional(),
      // UPI
      upiId: z.string().min(1).optional(),
      // PAYPAL
      paypalEmail: z.string().email().optional(),
    }),
    isDefault: z.boolean().optional(),
  }),
});

export const payoutMethodIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid payout method ID'),
  }),
});
