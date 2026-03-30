import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import { searchListings, searchSuggestions } from './search.controller.js';
import { searchListingsSchema, searchSuggestionsSchema } from './search.validation.js';

const router = Router();

// All search routes are public
router.get('/listings', validate(searchListingsSchema), searchListings);
router.get('/suggestions', validate(searchSuggestionsSchema), searchSuggestions);

export default router;
