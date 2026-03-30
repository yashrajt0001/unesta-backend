import { prisma } from '../../common/config/database.js';
import { AppError } from '../../common/middleware/error-handler.js';

// ─── Create Conversation ──────────────────────────────────────────────────────

interface CreateConversationInput {
  listingId: string;
  hostId: string;
  bookingId?: string;
  message: string;
}

export const createConversationService = async (guestId: string, input: CreateConversationInput) => {
  if (guestId === input.hostId) throw new AppError('You cannot message yourself', 400);

  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    select: { id: true, hostId: true },
  });
  if (!listing) throw new AppError('Listing not found', 404);
  if (listing.hostId !== input.hostId) throw new AppError('Host does not own this listing', 400);

  // Check if conversation already exists for this guest + listing
  const existing = await prisma.conversation.findFirst({
    where: { guestId, listingId: input.listingId },
  });
  if (existing) throw new AppError('Conversation already exists for this listing', 409);

  const conversation = await prisma.conversation.create({
    data: {
      listingId: input.listingId,
      guestId,
      hostId: input.hostId,
      bookingId: input.bookingId,
      lastMessageAt: new Date(),
      messages: {
        create: {
          senderId: guestId,
          content: input.message,
        },
      },
    },
    include: {
      listing: { select: { id: true, title: true } },
      guest: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      host: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      messages: { take: 1, orderBy: { createdAt: 'desc' } },
    },
  });

  return conversation;
};

// ─── Get Conversations ────────────────────────────────────────────────────────

export const getConversationsService = async (
  userId: string,
  role: 'guest' | 'host' | undefined,
  page: number,
  limit: number,
) => {
  const where = role
    ? (role === 'guest' ? { guestId: userId } : { hostId: userId })
    : { OR: [{ guestId: userId }, { hostId: userId }] };

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where: {
        ...where,
        // Hide archived conversations
        ...(role === 'guest'
          ? { isArchivedByGuest: false }
          : role === 'host'
            ? { isArchivedByHost: false }
            : {}),
      },
      include: {
        listing: { select: { id: true, title: true } },
        guest: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        host: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { content: true, senderId: true, createdAt: true, isRead: true },
        },
        _count: {
          select: {
            messages: { where: { isRead: false, senderId: { not: userId } } },
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.conversation.count({ where }),
  ]);

  return {
    conversations,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Get Messages ─────────────────────────────────────────────────────────────

export const getMessagesService = async (
  conversationId: string,
  userId: string,
  page: number,
  limit: number,
) => {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new AppError('Conversation not found', 404);
  if (conversation.guestId !== userId && conversation.hostId !== userId) {
    throw new AppError('Forbidden', 403);
  }

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.message.count({ where: { conversationId } }),
  ]);

  return {
    messages,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Send Message ─────────────────────────────────────────────────────────────

export const sendMessageService = async (conversationId: string, senderId: string, content: string) => {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new AppError('Conversation not found', 404);
  if (conversation.guestId !== senderId && conversation.hostId !== senderId) {
    throw new AppError('Forbidden', 403);
  }

  const [message] = await Promise.all([
    prisma.message.create({
      data: { conversationId, senderId, content },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  return message;
};

// ─── Mark as Read ─────────────────────────────────────────────────────────────

export const markAsReadService = async (messageId: string, userId: string) => {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { conversation: { select: { guestId: true, hostId: true } } },
  });

  if (!message) throw new AppError('Message not found', 404);
  if (message.conversation.guestId !== userId && message.conversation.hostId !== userId) {
    throw new AppError('Forbidden', 403);
  }
  // Only the recipient can mark as read
  if (message.senderId === userId) throw new AppError('Cannot mark your own message as read', 400);

  return prisma.message.update({
    where: { id: messageId },
    data: { isRead: true, readAt: new Date() },
    select: { id: true, isRead: true, readAt: true },
  });
};

// ─── Archive Conversation ─────────────────────────────────────────────────────

export const archiveConversationService = async (conversationId: string, userId: string) => {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new AppError('Conversation not found', 404);

  const isGuest = conversation.guestId === userId;
  const isHost = conversation.hostId === userId;
  if (!isGuest && !isHost) throw new AppError('Forbidden', 403);

  return prisma.conversation.update({
    where: { id: conversationId },
    data: isGuest ? { isArchivedByGuest: true } : { isArchivedByHost: true },
    select: { id: true, isArchivedByGuest: true, isArchivedByHost: true },
  });
};
