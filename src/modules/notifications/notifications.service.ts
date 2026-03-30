import { NotificationType } from '@prisma/client';
import { prisma } from '../../common/config/database.js';
import { AppError } from '../../common/middleware/error-handler.js';

// ─── Read (API) ───────────────────────────────────────────────────────────────

export const listNotificationsService = async (
  userId: string,
  unreadOnly: boolean,
  page: number,
  limit: number,
) => {
  const where = { userId, ...(unreadOnly ? { isRead: false } : {}) };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getUnreadCountService = async (userId: string) => {
  const count = await prisma.notification.count({ where: { userId, isRead: false } });
  return { count };
};

export const markAsReadService = async (notificationId: string, userId: string) => {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) throw new AppError('Notification not found', 404);
  if (notification.userId !== userId) throw new AppError('Forbidden', 403);
  if (notification.isRead) return notification;

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
};

export const markAllAsReadService = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return { updated: result.count };
};

// ─── Internal helpers (called by other modules) ───────────────────────────────

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export const createNotification = async (input: CreateNotificationInput) => {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
    },
  });
};

// ─── Convenience helpers used by other modules ────────────────────────────────

export const notifyBookingConfirmed = (guestId: string, listingTitle: string) =>
  createNotification({
    userId: guestId,
    type: NotificationType.BOOKING_CONFIRMED,
    title: 'Booking Confirmed',
    body: `Your booking for "${listingTitle}" has been confirmed.`,
  });

export const notifyBookingRequest = (hostId: string, listingTitle: string, guestName: string) =>
  createNotification({
    userId: hostId,
    type: NotificationType.BOOKING_REQUEST,
    title: 'New Booking Request',
    body: `${guestName} has requested to book "${listingTitle}".`,
  });

export const notifyBookingCancelled = (recipientId: string, listingTitle: string, by: 'guest' | 'host') =>
  createNotification({
    userId: recipientId,
    type: NotificationType.BOOKING_CANCELLED,
    title: 'Booking Cancelled',
    body: `A booking for "${listingTitle}" was cancelled by the ${by}.`,
  });

export const notifyNewMessage = (recipientId: string, senderName: string) =>
  createNotification({
    userId: recipientId,
    type: NotificationType.NEW_MESSAGE,
    title: 'New Message',
    body: `You have a new message from ${senderName}.`,
  });

export const notifyNewReview = (hostId: string, listingTitle: string) =>
  createNotification({
    userId: hostId,
    type: NotificationType.NEW_REVIEW,
    title: 'New Review',
    body: `A guest left a review for "${listingTitle}".`,
  });

export const notifyPayoutSent = (hostId: string, amount: number, currency: string) =>
  createNotification({
    userId: hostId,
    type: NotificationType.PAYOUT_SENT,
    title: 'Payout Sent',
    body: `A payout of ${currency} ${amount.toLocaleString()} has been sent to your account.`,
  });
