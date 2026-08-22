import { Router, type Router as ExpressRouter } from 'express';
import { organizationController } from '../controllers/organization.controller';
import { authenticate } from '../middlewares/authenticate';

const router: ExpressRouter = Router();

router.use(authenticate);

router.get('/', organizationController.get);
router.get('/members', organizationController.getMembers);
router.patch('/', organizationController.update);

export default router;
