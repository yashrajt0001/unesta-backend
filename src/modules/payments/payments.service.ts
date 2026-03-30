import { prisma } from '../../common/config/database.js';
import { AppError } from '../../common/middleware/error-handler.js';
import type { PaymentStatus, PayoutStatus, PayoutMethod } from '@prisma/client';

// ─── Payment History ──────────────────────────────────────────────────────────

export const getPaymentByIdService = async (id: string, userId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      booking: {
        select: {
          id: true,
          checkInDate: true,
          checkOutDate: true,
          listing: { select: { id: true, title: true } },
        },
      },
    },
  });

  if (!payment) throw new AppError('Payment not found', 404);
  if (payment.payerId !== userId) throw new AppError('Forbidden', 403);

  return payment;
};

export const getMyPaymentsService = async (
  userId: string,
  page: number,
  limit: number,
  status?: PaymentStatus,
) => {
  const where = { payerId: userId, ...(status && { status }) };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        booking: {
          select: {
            id: true,
            checkInDate: true,
            checkOutDate: true,
            listing: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Payout History ───────────────────────────────────────────────────────────

export const getMyPayoutsService = async (
  hostId: string,
  page: number,
  limit: number,
  status?: PayoutStatus,
) => {
  const where = { hostId, ...(status && { status }) };

  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({
      where,
      include: {
        booking: {
          select: {
            id: true,
            checkInDate: true,
            checkOutDate: true,
            listing: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payout.count({ where }),
  ]);

  return {
    payouts,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Payout Methods ───────────────────────────────────────────────────────────

interface AddPayoutMethodInput {
  methodType: PayoutMethod;
  details: Record<string, string>;
  isDefault?: boolean;
}

export const addPayoutMethodService = async (userId: string, input: AddPayoutMethodInput) => {
  // If setting as default, unset existing default
  if (input.isDefault) {
    await prisma.payoutMethod_.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  // If this is the first payout method, make it default
  const existingCount = await prisma.payoutMethod_.count({ where: { userId } });
  const isDefault = input.isDefault ?? existingCount === 0;

  return prisma.payoutMethod_.create({
    data: {
      userId,
      methodType: input.methodType,
      details: input.details,
      isDefault,
    },
  });
};

export const getPayoutMethodsService = async (userId: string) => {
  return prisma.payoutMethod_.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
};

export const deletePayoutMethodService = async (id: string, userId: string) => {
  const method = await prisma.payoutMethod_.findUnique({ where: { id } });
  if (!method) throw new AppError('Payout method not found', 404);
  if (method.userId !== userId) throw new AppError('Forbidden', 403);

  await prisma.payoutMethod_.delete({ where: { id } });

  // If deleted method was default, make the most recent one default
  if (method.isDefault) {
    const next = await prisma.payoutMethod_.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (next) {
      await prisma.payoutMethod_.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  return { message: 'Payout method deleted' };
};
