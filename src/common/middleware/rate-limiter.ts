import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV === 'development';

// Strict limiter for auth endpoints (5 req/15 min in prod, skipped in dev)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 1000 : 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
});

// General API limiter (100 req/min in prod, skipped in dev)
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isDev ? 10000 : 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
});
