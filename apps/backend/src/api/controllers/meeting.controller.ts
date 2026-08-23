import type { Request, Response, NextFunction } from 'express';
import { MeetingService } from '../../services/MeetingService';
import { sendSuccess } from '../../utils/response.utils';

const meetingService = new MeetingService();

export const meetingController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await meetingService.listMeetings(req.user!, req.query as never);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meeting = await meetingService.getMeeting(req.user!, req.params['id']!);
      sendSuccess(res, { meeting });
    } catch (err) {
      next(err);
    }
  },

  async lookup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const externalMeetingId = req.query['externalMeetingId'] as string;
      const meetingId = await meetingService.lookupByExternalId(req.user!, externalMeetingId);
      sendSuccess(res, { meetingId });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meeting = await meetingService.createMeeting(req.user!, req.body);
      sendSuccess(res, { meeting }, 201);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meeting = await meetingService.updateMeeting(req.user!, req.params['id']!, req.body);
      sendSuccess(res, { meeting });
    } catch (err) {
      next(err);
    }
  },
};
