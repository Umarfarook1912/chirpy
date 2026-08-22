import type { Response } from 'express';

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({ success: true, data } satisfies ApiSuccess<T>);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  fields?: Record<string, string[]>,
): Response {
  return res
    .status(statusCode)
    .json({ success: false, error: { code, message, ...(fields && { fields }) } } satisfies ApiError);
}
