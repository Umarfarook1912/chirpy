import { Router, type Router as ExpressRouter } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticate } from '../middlewares/authenticate';

const router: ExpressRouter = Router();

router.use(authenticate);

router.get('/meeting/:meetingId', reportController.getMeetingReport);
router.get('/organization', reportController.getOrganizationReport);

export default router;
