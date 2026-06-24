import crypto from 'crypto';
import { prisma } from '../../common/config/database.js';
import { AppError } from '../../common/middleware/error-handler.js';
import { razorpay } from '../../common/config/razorpay.js';
import { env } from '../../common/config/env.js';
import { notifyBookingConfirmed } from '../notifications/notifications.service.js';
import type {
  PaymentStatus,
  PayoutStatus,
  PayoutMethod,
  PaymentMethod,
  BookingStatus,
} from '@prisma/client';

// ─── Razorpay Checkout Flow ─────────────────────────────────────────────────────

function mapRazorpayMethod(method?: string): PaymentMethod {
  switch (method) {
    case 'card':
      return 'CARD';
    case 'netbanking':
      return 'BANK';
    case 'upi':
      return 'UPI';
    case 'wallet':
      return 'WALLET';
    default:
      return 'CARD';
  }
}

function signaturesMatch(expected: string, received: string): boolean {
  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  );
}

// Idempotent: marks a payment COMPLETED, confirms its booking, notifies the guest.
// Called from both the client-side verify endpoint and the Razorpay webhook.
async function markPaymentCaptured(
  payment: { id: string; bookingId: string; status: PaymentStatus },
  gatewayPaymentId: string,
  method?: string,
): Promise<void> {
  if (payment.status === 'COMPLETED') return;

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        gatewayTransactionId: gatewayPaymentId,
        paymentMethod: mapRazorpayMethod(method),
        paidAt: new Date(),
      },
    }),
    // Only advance live bookings — never resurrect a cancelled/declined one.
    prisma.booking.updateMany({
      where: { id: payment.bookingId, status: { in: ['PENDING', 'CONFIRMED'] } },
      data: { status: 'CONFIRMED' },
    }),
  ]);

  const booking = await prisma.booking.findUnique({
    where: { id: payment.bookingId },
    select: { guestId: true, listing: { select: { title: true } } },
  });
  if (booking) await notifyBookingConfirmed(booking.guestId, booking.listing.title);
}

// Step 1: guest requests a Razorpay order for a booking. Frontend opens checkout with this.
export const createPaymentOrderService = async (userId: string, bookingId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      guestId: true,
      totalPrice: true,
      currency: true,
      status: true,
      listing: { select: { title: true } },
      payment: { select: { status: true } },
    },
  });

  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.guestId !== userId) throw new AppError('Forbidden', 403);

  const unpayable: BookingStatus[] = [
    'CANCELLED_BY_GUEST',
    'CANCELLED_BY_HOST',
    'DECLINED',
    'EXPIRED',
    'COMPLETED',
  ];
  if (unpayable.includes(booking.status)) {
    throw new AppError('This booking can no longer be paid for', 400);
  }
  if (booking.payment?.status === 'COMPLETED') {
    throw new AppError('This booking is already paid', 400);
  }

  const amountInPaise = Math.round(booking.totalPrice * 100);

  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: booking.currency,
    receipt: booking.id,
    notes: { bookingId: booking.id },
  });

  await prisma.payment.upsert({
    where: { bookingId: booking.id },
    create: {
      bookingId: booking.id,
      payerId: userId,
      amount: booking.totalPrice,
      currency: booking.currency,
      gatewayOrderId: order.id,
      status: 'PENDING',
    },
    update: {
      gatewayOrderId: order.id,
      amount: booking.totalPrice,
      status: 'PENDING',
    },
  });

  return {
    orderId: order.id,
    amount: amountInPaise,
    currency: booking.currency,
    keyId: env.RAZORPAY_KEY_ID,
    bookingId: booking.id,
    listingTitle: booking.listing.title,
  };
};

// Step 2: frontend posts the Razorpay handler response here to confirm payment.
export const verifyPaymentService = async (
  userId: string,
  input: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
) => {
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest('hex');
  if (!signaturesMatch(expected, input.razorpaySignature)) {
    throw new AppError('Invalid payment signature', 400);
  }

  const payment = await prisma.payment.findUnique({
    where: { gatewayOrderId: input.razorpayOrderId },
    select: { id: true, bookingId: true, payerId: true, status: true },
  });
  if (!payment) throw new AppError('Payment not found', 404);
  if (payment.payerId !== userId) throw new AppError('Forbidden', 403);

  if (payment.status !== 'COMPLETED') {
    const rp = await razorpay.payments.fetch(input.razorpayPaymentId);
    const captured = rp.status === 'captured' || rp.status === 'authorized';
    if (rp.order_id !== input.razorpayOrderId || !captured) {
      throw new AppError('Payment not captured', 400);
    }
    await markPaymentCaptured(
      payment,
      rp.id,
      typeof rp.method === 'string' ? rp.method : undefined,
    );
  }

  return prisma.payment.findUnique({ where: { id: payment.id } });
};

// Server-to-server confirmation from Razorpay. The source of truth for capture/failure.
export const handleWebhookService = async (rawBody: Buffer | undefined, signature?: string) => {
  if (!env.RAZORPAY_WEBHOOK_SECRET) throw new AppError('Webhook not configured', 503);
  if (!rawBody || !signature) throw new AppError('Invalid webhook request', 400);

  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  if (!signaturesMatch(expected, signature)) {
    throw new AppError('Invalid webhook signature', 400);
  }

  const event = JSON.parse(rawBody.toString());
  const entity = event?.payload?.payment?.entity;
  if (!entity?.order_id) return { received: true };

  const payment = await prisma.payment.findUnique({
    where: { gatewayOrderId: entity.order_id },
    select: { id: true, bookingId: true, status: true },
  });
  if (!payment) return { received: true };

  if (event.event === 'payment.captured') {
    await markPaymentCaptured(payment, entity.id, entity.method);
  } else if (event.event === 'payment.failed' && payment.status !== 'COMPLETED') {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
  }

  return { received: true };
};

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

export const updatePayoutMethodService = async (
  id: string,
  userId: string,
  input: { details?: Record<string, string>; isDefault?: boolean },
) => {
  const method = await prisma.payoutMethod_.findUnique({ where: { id } });
  if (!method) throw new AppError('Payout method not found', 404);
  if (method.userId !== userId) throw new AppError('Forbidden', 403);

  if (input.isDefault) {
    await prisma.payoutMethod_.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.payoutMethod_.update({
    where: { id },
    data: {
      ...(input.details && { details: input.details }),
      ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
    },
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
