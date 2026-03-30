import { Router } from 'express';
import { authenticateUser, optionalAuthenticateUser } from '../../common/middleware/auth.middleware.js';
import { uploadSingle } from '../../common/middleware/upload.middleware.js';
import { validate } from '../../common/middleware/validate.js';
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
  getAllAmenities,
  addListingImage,
  deleteListingImage,
  setCoverImage,
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
} from './listings.validation.js';

const router = Router();

// ─── Public ────────────────────────────────────────────────────────────────────
router.get('/amenities', getAllAmenities);
router.get('/:id/availability', validate(getAvailabilitySchema), getAvailability);
router.get('/:id', optionalAuthenticateUser, validate(listingIdParamSchema), getListingById);

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
router.delete('/:id/images/:imageId', validate(deleteListingImageSchema), deleteListingImage);
router.patch('/:id/images/:imageId/cover', validate(setCoverImageSchema), setCoverImage);

export default router;
