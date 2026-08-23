import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { ENV } from '../../config/env';

export const credentialRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => ENV.NODE_ENV === 'development',
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
  },
});
