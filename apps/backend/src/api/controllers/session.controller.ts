import type { Request, Response, NextFunction } from 'express';
import { SessionRepository } from '../../repositories/SessionRepository';
import { MeetingRepository } from '../../repositories/MeetingRepository';
import { ParticipationScoringService } from '../../services/ParticipationScoringService';
import { sendSuccess } from '../../utils/response.utils';
import { ConflictError } from '../../errors/ConflictError';
import { NotFoundError } from '../../errors/NotFoundError';
import { AuthorizationError } from '../../errors/AuthorizationError';
import type { SessionSyncInput } from '@chirpy/shared';
import type { Types } from 'mongoose';

const sessionRepo = new SessionRepository();
const meetingRepo = new MeetingRepository();
const scoringService = new ParticipationScoringService();

export const sessionController = {
  async sync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body as SessionSyncInput;

      const existing = await sessionRepo.findByIdempotencyKey(payload.idempotencyKey);
      if (existing) {
        sendSuccess(res, { message: 'Session already synced', sessionId: String(existing._id) });
        return;
      }

      let meeting = (await meetingRepo.findByOrganization(req.user!.organizationId, {
        limit: 1,
      })).meetings.find((m) => m.externalMeetingId === payload.externalMeetingId);

      if (!meeting) {
        const created = await meetingRepo.create({
          organizationId: req.user!.organizationId as unknown as Types.ObjectId,
          title: payload.meetingTitle,
          platform: payload.platform as 'google_meet' | 'teams' | 'zoom' | 'other',
          externalMeetingId: payload.externalMeetingId,
          hostId: req.user!.userId as unknown as Types.ObjectId,
          scheduledAt: new Date(payload.startedAt),
        });
        meeting = {
          _id: created._id,
          organizationId: created.organizationId,
          title: created.title,
          platform: created.platform,
          status: created.status,
          startedAt: created.startedAt,
          endedAt: created.endedAt,
          externalMeetingId: created.externalMeetingId,
        } as never;
      }

      const sessionScore = scoringService.scoreSession(payload);
      const startedAt = new Date(payload.startedAt);
      const endedAt = new Date(payload.endedAt);
      const durationSeconds = Math.max(0, (endedAt.getTime() - startedAt.getTime()) / 1_000);

      const { session } = await sessionRepo.createWithInteractions(
        {
          meetingId: (meeting as { _id: Types.ObjectId })._id,
          organizationId: req.user!.organizationId as unknown as Types.ObjectId,
          startedAt,
          endedAt,
          durationSeconds,
          idempotencyKey: payload.idempotencyKey,
        },
        sessionScore.participants.map((p) => ({
          meetingId: (meeting as { _id: Types.ObjectId })._id,
          organizationId: req.user!.organizationId as unknown as Types.ObjectId,
          displayName: p.displayName,
          attendanceDurationSeconds: p.attendanceDurationSeconds,
          chatMessageCount: p.chatMessageCount,
          handRaiseCount: p.handRaiseCount,
          reactionCount: p.reactionCount,
          speakingDurationSeconds: p.speakingDurationSeconds,
          participationScore: p.participationScore,
        })),
      );

      sendSuccess(res, { sessionId: String(session._id), score: sessionScore.averageScore }, 201);
    } catch (err) {
      next(err);
    }
  },
};
