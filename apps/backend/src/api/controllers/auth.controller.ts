import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../services/AuthService';
import { sendSuccess } from '../../utils/response.utils';
import { ENV } from '../../config/env';

const authService = new AuthService();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: ENV.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

export const authController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { profile, accessToken, refreshToken } = await authService.register(req.body);
      setTokenCookies(res, accessToken, refreshToken);
      sendSuccess(res, { profile }, 201);
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { profile, accessToken, refreshToken } = await authService.login(req.body);
      setTokenCookies(res, accessToken, refreshToken);
      sendSuccess(res, { profile });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = (req.cookies?.refreshToken as string | undefined) ?? req.body.refreshToken as string;
      const { accessToken, refreshToken: newRefreshToken } = await authService.refreshTokens(refreshToken);
      setTokenCookies(res, accessToken, newRefreshToken);
      sendSuccess(res, { message: 'Tokens refreshed', accessToken });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user) {
        await authService.logout(req.user.userId);
      }
      res.clearCookie('accessToken', COOKIE_OPTIONS);
      res.clearCookie('refreshToken', COOKIE_OPTIONS);
      sendSuccess(res, { message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, { user: req.user });
    } catch (err) {
      next(err);
    }
  },
};

function setTokenCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie('accessToken', accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1_000 });
  res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1_000 });
}
