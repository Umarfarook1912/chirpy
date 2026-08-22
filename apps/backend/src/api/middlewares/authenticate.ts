import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env';
import { AuthenticationError } from '../../errors/AuthenticationError';
import type { AuthTokenPayload } from '@chirpy/shared';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    next(new AuthenticationError('No authentication token provided'));
    return;
  }

  try {
    const payload = jwt.verify(token, ENV.JWT_SECRET) as AuthTokenPayload;
    req.user = payload;
    next();
  } catch {
    next(new AuthenticationError('Invalid or expired authentication token'));
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const cookieToken = req.cookies?.accessToken as string | undefined;
  if (cookieToken) return cookieToken;

  return null;
}
