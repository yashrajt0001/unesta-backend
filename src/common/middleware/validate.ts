import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      next(result.error);
      return;
    }

    // Replace with parsed (coerced/defaulted) values
    req.body = result.data.body;
    // Shadow req.query/params on the instance so Zod defaults (new keys) persist
    if (result.data.query) {
      Object.defineProperty(req, 'query', {
        value: { ...req.query, ...result.data.query },
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    if (result.data.params) Object.assign(req.params, result.data.params);

    next();
  };
};
