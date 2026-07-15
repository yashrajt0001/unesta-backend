import type { Request, Response, NextFunction } from 'express';

/**
 * Sets Cache-Control on GET responses so browsers (and CDNs, when `scope` is
 * 'public') can reuse a recent response instead of hitting the API on every
 * navigation. Only applies to GET — never caches mutations.
 *
 * - `public`  → shared caches may store it (use only for user-agnostic data).
 * - `private` → browser-only. Use when the body varies per signed-in user
 *   (e.g. listings stamped with `isSaved`); also emits `Vary: Authorization`.
 */
export const cacheControl = (
  scope: 'public' | 'private',
  maxAge: number,
  staleWhileRevalidate = maxAge * 4,
) => {
  const value = `${scope}, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', value);
      if (scope === 'private') res.setHeader('Vary', 'Authorization');
    }
    next();
  };
};
