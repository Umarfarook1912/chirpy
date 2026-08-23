import type { Request, Response, NextFunction } from 'express';
import { appendFileSync } from 'fs';
import { join } from 'path';
import { SessionRepository } from '../../repositories/SessionRepository';import { MeetingRepository } from '../../repositories/MeetingRepository';
import { ParticipationScoringService } from '../../services/ParticipationScoringService';
import { sendSuccess } from '../../utils/response.utils';
import type { SessionSyncInput } from '@chirpy/shared';
import type { Types } from 'mongoose';

const sessionRepo = new SessionRepository();
const meetingRepo = new MeetingRepository();
const scoringService = new ParticipationScoringService();

const DEBUG_LOG_PATH = join(process.cwd(), '.cursor', 'debug-fb5d5f.log');
function writeBackendDebugLog(data: Record<string, unknown>): void {
  try {
    appendFileSync(DEBUG_LOG_PATH, `${JSON.stringify({ sessionId: 'fb5d5f', ...data, timestamp: Date.now() })}\n`);
  } catch {
    /* ignore */
  }
}

export const sessionController = {
  async sync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body as SessionSyncInput;

      const existing = await sessionRepo.findByIdempotencyKey(payload.idempotencyKey);
      if (existing) {
        const meetingId = String(existing.meetingId);
        writeBackendDebugLog({
          hypothesisId: 'H-sync',
          location: 'session.controller:sync',
          message: 'duplicate session',
          data: { meetingId },
        });
        sendSuccess(res, {
          message: 'Session already synced',
          sessionId: String(existing._id),
          meetingId,
        });
        return;
      }

      let meeting = await meetingRepo.findByExternalId(
        req.user!.organizationId,
        payload.externalMeetingId,
      );

      if (!meeting) {
        const created = await meetingRepo.create({
          organizationId: req.user!.organizationId as unknown as Types.ObjectId,
          title: payload.meetingTitle,
          platform: payload.platform as 'google_meet' | 'teams' | 'zoom' | 'other',
          externalMeetingId: payload.externalMeetingId,
          hostId: req.user!.userId as unknown as Types.ObjectId,
          scheduledAt: new Date(payload.startedAt),
        });
        meeting = created;
      }

      const sessionScore = scoringService.scoreSession(payload);
      const startedAt = new Date(payload.startedAt);
      const endedAt = new Date(payload.endedAt);
      const durationSeconds = Math.max(0, (endedAt.getTime() - startedAt.getTime()) / 1_000);

      const { session } = await sessionRepo.createWithInteractions(
        {
          meetingId: meeting._id,
          organizationId: req.user!.organizationId as unknown as Types.ObjectId,
          startedAt,
          endedAt,
          durationSeconds,
          idempotencyKey: payload.idempotencyKey,
        },
        sessionScore.participants.map((p) => ({
          meetingId: meeting._id,
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

      await meetingRepo.update(String(meeting._id), {
        title: payload.meetingTitle,
        status: 'completed',
        startedAt,
        endedAt,
      });

      writeBackendDebugLog({
        hypothesisId: 'H-sync',
        location: 'session.controller:sync',
        message: 'session created',
        data: { meetingId: String(meeting._id) },
      });

      sendSuccess(res, {
        sessionId: String(session._id),
        meetingId: String(meeting._id),
        score: sessionScore.averageScore,
      }, 201);    } catch (err) {
      next(err);
    }
  },
};
