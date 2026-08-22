import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../errors/AppError';
import { ValidationError } from '../../errors/ValidationError';
import { sendError } from '../../utils/response.utils';
import { ENV } from '../../config/env';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): Response {
  if (err instanceof ValidationError) {
    return sendError(res, err.statusCode, err.code, err.message, err.fields);
  }

  if (err instanceof AppError && err.isOperational) {
    return sendError(res, err.statusCode, err.code, err.message);
  }

  console.error('Unhandled error:', err);

  const message =
    ENV.NODE_ENV === 'development' && err instanceof Error
      ? err.message
      : 'An unexpected error occurred';

  return sendError(res, 500, 'INTERNAL_SERVER_ERROR', message);
}
