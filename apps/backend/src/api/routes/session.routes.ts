import { Router, type Router as ExpressRouter } from 'express';
import { sessionController } from '../controllers/session.controller';
import { authenticate } from '../middlewares/authenticate';
import { validate } from '../middlewares/validate';
import { SessionSyncSchema } from '@chirpy/shared';

const router: ExpressRouter = Router();

router.use(authenticate);

router.post('/sync', validate(SessionSyncSchema), sessionController.sync);

export default router;
