import { prisma } from '../../common/config/database.js';
import { AppError } from '../../common/middleware/error-handler.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const assertOwner = async (wishlistId: string, userId: string) => {
  const wishlist = await prisma.wishlist.findUnique({ where: { id: wishlistId } });
  if (!wishlist) throw new AppError('Wishlist not found', 404);
  if (wishlist.userId !== userId) throw new AppError('Forbidden', 403);
  return wishlist;
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export const getWishlistsService = async (userId: string) => {
  return prisma.wishlist.findMany({
    where: { userId },
    include: {
      _count: { select: { items: true } },
      items: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        include: {
          listing: {
            select: { id: true, title: true, images: { take: 1, select: { url: true }, orderBy: { sortOrder: 'asc' } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getWishlistService = async (wishlistId: string, userId: string) => {
  const wishlist = await prisma.wishlist.findUnique({
    where: { id: wishlistId },
    include: {
      items: {
        include: {
          listing: {
            select: {
              id: true, title: true, city: true, country: true, basePrice: true, status: true,
              images: { take: 1, select: { url: true }, orderBy: { sortOrder: 'asc' } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!wishlist) throw new AppError('Wishlist not found', 404);
  if (wishlist.userId !== userId) throw new AppError('Forbidden', 403);
  return wishlist;
};

export const createWishlistService = async (userId: string, name: string) => {
  return prisma.wishlist.create({
    data: { userId, name },
    include: { _count: { select: { items: true } } },
  });
};

export const updateWishlistService = async (wishlistId: string, userId: string, name: string) => {
  await assertOwner(wishlistId, userId);
  return prisma.wishlist.update({
    where: { id: wishlistId },
    data: { name },
    select: { id: true, name: true, updatedAt: true },
  });
};

export const deleteWishlistService = async (wishlistId: string, userId: string) => {
  await assertOwner(wishlistId, userId);
  await prisma.wishlist.delete({ where: { id: wishlistId } });
};

// ─── Items ────────────────────────────────────────────────────────────────────

export const addItemService = async (wishlistId: string, userId: string, listingId: string, note?: string) => {
  await assertOwner(wishlistId, userId);

  const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true } });
  if (!listing) throw new AppError('Listing not found', 404);

  const existing = await prisma.wishlistItem.findUnique({
    where: { wishlistId_listingId: { wishlistId, listingId } },
  });
  if (existing) throw new AppError('Listing already in this wishlist', 409);

  return prisma.wishlistItem.create({
    data: { wishlistId, listingId, note },
    include: {
      listing: {
        select: { id: true, title: true, basePrice: true },
      },
    },
  });
};

export const removeItemService = async (wishlistId: string, userId: string, listingId: string) => {
  await assertOwner(wishlistId, userId);

  const item = await prisma.wishlistItem.findUnique({
    where: { wishlistId_listingId: { wishlistId, listingId } },
  });
  if (!item) throw new AppError('Item not found in wishlist', 404);

  await prisma.wishlistItem.delete({ where: { wishlistId_listingId: { wishlistId, listingId } } });
};
