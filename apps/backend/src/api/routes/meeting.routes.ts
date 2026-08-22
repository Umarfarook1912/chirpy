import { Router, type Router as ExpressRouter } from 'express';
import { meetingController } from '../controllers/meeting.controller';
import { authenticate } from '../middlewares/authenticate';
import { validate } from '../middlewares/validate';
import { CreateMeetingSchema, UpdateMeetingSchema, MeetingQuerySchema } from '@chirpy/shared';

const router: ExpressRouter = Router();

router.use(authenticate);

router.get('/', validate(MeetingQuerySchema, 'query'), meetingController.list);
router.get('/:id', meetingController.get);
router.post('/', validate(CreateMeetingSchema), meetingController.create);
router.patch('/:id', validate(UpdateMeetingSchema), meetingController.update);

export default router;
