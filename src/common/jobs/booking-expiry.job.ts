import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { refundBookingPaymentService } from '../../modules/payments/payments.service.js';
import {
  notifyBookingExpired,
  notifyBookingExpiredHost,
} from '../../modules/notifications/notifications.service.js';

const CHECK_INTERVAL_MS = 60 * 1000;
const BATCH_SIZE = 50;

let timer: NodeJS.Timeout | null = null;

// Paid request-to-book bookings the host never confirmed inside their response window:
// expire them so the dates are released, and refund the guest in full.
export const expireOverdueBookings = async (): Promise<number> => {
  const overdue = await prisma.booking.findMany({
    where: { status: 'AWAITING_HOST', hostResponseDeadline: { lt: new Date() } },
    select: { id: true, guestId: true, hostId: true, listing: { select: { title: true } } },
    take: BATCH_SIZE,
  });

  let expired = 0;

  for (const booking of overdue) {
    try {
      // Flip the status first — if the host accepts at the same moment, one of us loses.
      const claimed = await prisma.booking.updateMany({
        where: { id: booking.id, status: 'AWAITING_HOST' },
        data: {
          status: 'EXPIRED',
          cancelledAt: new Date(),
          cancellationReason: 'Host did not confirm in time',
        },
      });
      if (claimed.count === 0) continue;

      const refundAmount = await refundBookingPaymentService(
        booking.id,
        'Host did not confirm in time',
      );
      if (refundAmount !== null) {
        await prisma.booking.update({ where: { id: booking.id }, data: { refundAmount } });
      }

      await notifyBookingExpired(booking.guestId, booking.listing.title, refundAmount);
      await notifyBookingExpiredHost(booking.hostId, booking.listing.title);
      expired += 1;
    } catch (error) {
      logger.error({ err: error, bookingId: booking.id }, 'Failed to expire booking');
    }
  }

  return expired;
};

// A refund can fail after the booking was already marked dead (gateway error, network).
// Retry those so a guest is never left charged for a booking that will never happen.
export const retryMissedRefunds = async (): Promise<number> => {
  const stuck = await prisma.booking.findMany({
    where: {
      status: { in: ['EXPIRED', 'DECLINED'] },
      payment: { status: 'COMPLETED' },
    },
    select: { id: true, guestId: true, listing: { select: { title: true } } },
    take: BATCH_SIZE,
  });

  let refunded = 0;

  for (const booking of stuck) {
    try {
      const refundAmount = await refundBookingPaymentService(booking.id, 'Retry of a failed refund');
      if (refundAmount === null) continue;

      await prisma.booking.update({ where: { id: booking.id }, data: { refundAmount } });
      await notifyBookingExpired(booking.guestId, booking.listing.title, refundAmount);
      refunded += 1;
    } catch (error) {
      logger.error({ err: error, bookingId: booking.id }, 'Refund retry failed');
    }
  }

  return refunded;
};

export const startBookingExpiryJob = () => {
  if (timer) return;
  timer = setInterval(() => {
    expireOverdueBookings()
      .then(() => retryMissedRefunds())
      .catch((error) => {
        logger.error({ err: error }, 'Booking expiry job failed');
      });
  }, CHECK_INTERVAL_MS);
};

export const stopBookingExpiryJob = () => {
  if (timer) clearInterval(timer);
  timer = null;
};
