import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import { authenticateUser } from '../../common/middleware/auth.middleware.js';
import { placesAutocomplete, placeDetails } from './places.controller.js';
import { autocompleteSchema, placeDetailsSchema } from './places.validation.js';

const router = Router();

// Proxy to Google Places (New) using the server key. Auth required to keep the
// proxy from being used as an open relay against our Maps billing.
router.get('/autocomplete', authenticateUser, validate(autocompleteSchema), placesAutocomplete);
router.get('/details', authenticateUser, validate(placeDetailsSchema), placeDetails);

export default router;
