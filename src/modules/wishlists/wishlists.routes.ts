import { Router } from 'express';
import { authenticateUser } from '../../common/middleware/auth.middleware.js';
import { validate } from '../../common/middleware/validate.js';
import {
  getWishlists,
  getWishlist,
  createWishlist,
  updateWishlist,
  deleteWishlist,
  addItem,
  removeItem,
} from './wishlists.controller.js';
import {
  createWishlistSchema,
  updateWishlistSchema,
  wishlistIdParamSchema,
  addItemSchema,
  removeItemSchema,
} from './wishlists.validation.js';

const router = Router();

router.use(authenticateUser);

router.get('/', getWishlists);
router.post('/', validate(createWishlistSchema), createWishlist);
router.get('/:id', validate(wishlistIdParamSchema), getWishlist);
router.put('/:id', validate(updateWishlistSchema), updateWishlist);
router.delete('/:id', validate(wishlistIdParamSchema), deleteWishlist);
router.post('/:id/items', validate(addItemSchema), addItem);
router.delete('/:id/items/:listingId', validate(removeItemSchema), removeItem);

export default router;
