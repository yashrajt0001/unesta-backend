import { Router } from 'express';
import { authenticateUser, optionalAuthenticateUser } from '../../common/middleware/auth.middleware.js';
import { uploadSingle } from '../../common/middleware/upload.middleware.js';
import { validate } from '../../common/middleware/validate.js';
import { cacheControl } from '../../common/middleware/cache-control.js';
import {
  createListing,
  getListingById,
  getMyListings,
  updateListing,
  updateListingStatus,
  deleteListing,
  addHouseRules,
  deleteHouseRule,
  updateAvailability,
  getAvailability,
  getUnavailableDates,
  getAllAmenities,
  addListingImage,
  deleteListingImage,
  setCoverImage,
  reorderImages,
} from './listings.controller.js';
import {
  createListingSchema,
  updateListingSchema,
  listingIdParamSchema,
  updateListingStatusSchema,
  addHouseRulesSchema,
  deleteHouseRuleSchema,
  updateAvailabilitySchema,
  getAvailabilitySchema,
  getMyListingsSchema,
  deleteListingImageSchema,
  setCoverImageSchema,
  reorderImagesSchema,
} from './listings.validation.js';

const router = Router();

// ─── Public ────────────────────────────────────────────────────────────────────
// Amenities are a static reference list — cache hard.
router.get('/amenities', cacheControl('public', 3600), getAllAmenities);
router.get('/:id/availability', cacheControl('public', 60), validate(getAvailabilitySchema), getAvailability);
router.get('/:id/unavailable-dates', cacheControl('public', 60), validate(getAvailabilitySchema), getUnavailableDates);
// Detail body carries per-user `isSaved` → private, browser-only cache.
router.get('/:id', cacheControl('private', 30), optionalAuthenticateUser, validate(listingIdParamSchema), getListingById);

// ─── Authenticated ─────────────────────────────────────────────────────────────
router.use(authenticateUser);

router.post('/', validate(createListingSchema), createListing);
router.get('/', validate(getMyListingsSchema), getMyListings);

router.patch('/:id', validate(updateListingSchema), updateListing);
router.patch('/:id/status', validate(updateListingStatusSchema), updateListingStatus);
router.delete('/:id', validate(listingIdParamSchema), deleteListing);

router.post('/:id/house-rules', validate(addHouseRulesSchema), addHouseRules);
router.delete('/:id/house-rules/:ruleId', validate(deleteHouseRuleSchema), deleteHouseRule);

router.put('/:id/availability', validate(updateAvailabilitySchema), updateAvailability);

router.post('/:id/images', uploadSingle, addListingImage);
router.put('/:id/images/reorder', validate(reorderImagesSchema), reorderImages);
router.delete('/:id/images/:imageId', validate(deleteListingImageSchema), deleteListingImage);
router.patch('/:id/images/:imageId/cover', validate(setCoverImageSchema), setCoverImage);

export default router;
