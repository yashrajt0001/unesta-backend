import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import { optionalAuthenticateUser } from '../../common/middleware/auth.middleware.js';
import { cacheControl } from '../../common/middleware/cache-control.js';
import { searchListings, searchSuggestions } from './search.controller.js';
import { searchListingsSchema, searchSuggestionsSchema } from './search.validation.js';

const router = Router();

// Public, but reads the user (if signed in) to stamp isSaved on each listing —
// so the response is per-user: cache privately (browser only), short-lived.
router.get(
  '/listings',
  cacheControl('private', 30),
  optionalAuthenticateUser,
  validate(searchListingsSchema),
  searchListings,
);
// Suggestions are user-agnostic — safe to cache in shared caches longer.
router.get(
  '/suggestions',
  cacheControl('public', 300),
  validate(searchSuggestionsSchema),
  searchSuggestions,
);

export default router;
