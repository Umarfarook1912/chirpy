import type { Request, Response, NextFunction } from 'express';
import { hasMinimumRole } from '@chirpy/shared';
import type { UserRole } from '@chirpy/shared';
import { AuthenticationError } from '../../errors/AuthenticationError';
import { AuthorizationError } from '../../errors/AuthorizationError';

export function authorize(minimumRole: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthenticationError());
      return;
    }

    if (!hasMinimumRole(req.user.role, minimumRole)) {
      next(new AuthorizationError());
      return;
    }

    next();
  };
}
