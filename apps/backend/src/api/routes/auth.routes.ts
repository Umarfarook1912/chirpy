import { Router, type Router as ExpressRouter } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { authenticate } from '../middlewares/authenticate';
import { credentialRateLimiter } from '../middlewares/credentialRateLimiter';
import { RegisterSchema, LoginSchema } from '@chirpy/shared';

const router: ExpressRouter = Router();

router.post('/register', credentialRateLimiter, validate(RegisterSchema), authController.register);
router.post('/login', credentialRateLimiter, validate(LoginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
