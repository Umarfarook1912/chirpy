import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../../errors/ValidationError';

type ValidateTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: ValidateTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.');
        if (!fields[path]) fields[path] = [];
        fields[path].push(issue.message);
      }
      next(new ValidationError('Validation failed', fields));
      return;
    }

    req[target] = result.data as Request[ValidateTarget];
    next();
  };
}
