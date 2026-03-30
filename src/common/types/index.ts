import type { Request, Response, NextFunction } from 'express';

// Re-export typed request aliases for convenience
export type AuthenticatedRequest = Request;
export type AdminAuthenticatedRequest = Request;

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Wraps async route handlers — catches errors and forwards to Express error handler.
// Eliminates try/catch boilerplate in every controller.
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export const asyncHandler = (fn: AsyncHandler) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
};
