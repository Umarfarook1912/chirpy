import { MeetingRepository } from '../repositories/MeetingRepository';
import { NotFoundError } from '../errors/NotFoundError';
import { AuthorizationError } from '../errors/AuthorizationError';
import { SessionModel } from '../models/Session.model';
import { InteractionModel } from '../models/Interaction.model';
import type {
  CreateMeetingInput,
  UpdateMeetingInput,
  MeetingQueryInput,
  AuthTokenPayload,
  Meeting,
  MeetingSummary,
} from '@chirpy/shared';
import type { MeetingDocument } from '../models/Meeting.model';
import type { Types } from 'mongoose';

const meetingRepo = new MeetingRepository();

export class MeetingService {
  async listMeetings(
    user: AuthTokenPayload,
    query: MeetingQueryInput,
  ): Promise<{ meetings: MeetingSummary[]; total: number; page: number; limit: number }> {
    const { meetings, total } = await meetingRepo.findByOrganization(user.organizationId, query);
    const statsByMeetingId = await this.getMeetingStatsMap(meetings.map((m) => String(m._id)));

    return {
      meetings: meetings.map((m) => this.toSummary(m, statsByMeetingId.get(String(m._id)))),
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  async getMeeting(user: AuthTokenPayload, meetingId: string): Promise<Meeting> {
    const meeting = await meetingRepo.findById(meetingId);
    if (!meeting) throw new NotFoundError('Meeting');
    if (String(meeting.organizationId) !== user.organizationId) throw new AuthorizationError();
    return this.toMeeting(meeting);
  }

  async lookupByExternalId(user: AuthTokenPayload, externalMeetingId: string): Promise<string> {
    if (!externalMeetingId?.trim()) throw new NotFoundError('Meeting');
    const meeting = await meetingRepo.findByExternalId(user.organizationId, externalMeetingId);
    if (!meeting) throw new NotFoundError('Meeting');
    return String(meeting._id);
  }

  async createMeeting(user: AuthTokenPayload, input: CreateMeetingInput): Promise<Meeting> {
    const meeting = await meetingRepo.create({
      organizationId: user.organizationId as unknown as Types.ObjectId,
      title: input.title,
      description: input.description,
      platform: input.platform ?? 'google_meet',
      externalMeetingId: input.externalMeetingId,
      hostId: user.userId as unknown as Types.ObjectId,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
    });
    return this.toMeeting(meeting);
  }

  async updateMeeting(
    user: AuthTokenPayload,
    meetingId: string,
    input: UpdateMeetingInput,
  ): Promise<Meeting> {
    const existing = await meetingRepo.findById(meetingId);
    if (!existing) throw new NotFoundError('Meeting');
    if (String(existing.organizationId) !== user.organizationId) throw new AuthorizationError();

    const updated = await meetingRepo.update(meetingId, input as never);
    if (!updated) throw new NotFoundError('Meeting');
    return this.toMeeting(updated);
  }

  private toMeeting(doc: MeetingDocument): Meeting {
    return {
      id: String(doc._id),
      organizationId: String(doc.organizationId),
      title: doc.title,
      description: doc.description,
      platform: doc.platform,
      externalMeetingId: doc.externalMeetingId,
      status: doc.status,
      scheduledAt: doc.scheduledAt?.toISOString(),
      startedAt: doc.startedAt?.toISOString(),
      endedAt: doc.endedAt?.toISOString(),
      hostId: String(doc.hostId),
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private async getMeetingStatsMap(
    meetingIds: string[],
  ): Promise<Map<string, { participantCount: number; averageParticipationScore: number }>> {
    const stats = new Map<string, { participantCount: number; averageParticipationScore: number }>();
    if (meetingIds.length === 0) return stats;

    const sessions = await SessionModel.find({ meetingId: { $in: meetingIds } })
      .select('_id meetingId')
      .exec();
    const sessionIds = sessions.map((s) => s._id);
    const sessionToMeeting = new Map(
      sessions.map((s) => [String(s._id), String(s.meetingId)]),
    );

    const interactions = await InteractionModel.find({ sessionId: { $in: sessionIds } })
      .select('sessionId participationScore')
      .exec();

    for (const interaction of interactions) {
      const meetingId = sessionToMeeting.get(String(interaction.sessionId));
      if (!meetingId) continue;

      const current = stats.get(meetingId) ?? {
        participantCount: 0,
        averageParticipationScore: 0,
        totalScore: 0,
      };
      current.participantCount += 1;
      (current as { totalScore: number }).totalScore += interaction.participationScore;
      stats.set(meetingId, current);
    }

    const result = new Map<string, { participantCount: number; averageParticipationScore: number }>();
    for (const [meetingId, value] of stats) {
      const totalScore = (value as { totalScore?: number }).totalScore ?? 0;
      result.set(meetingId, {
        participantCount: value.participantCount,
        averageParticipationScore:
          value.participantCount > 0 ? Math.round(totalScore / value.participantCount) : 0,
      });
    }

    return result;
  }

  private toSummary(
    doc: MeetingDocument,
    stats?: { participantCount: number; averageParticipationScore: number },
  ): MeetingSummary {
    const durationMs =
      doc.startedAt && doc.endedAt
        ? doc.endedAt.getTime() - doc.startedAt.getTime()
        : undefined;

    return {
      id: String(doc._id),
      title: doc.title,
      platform: doc.platform,
      status: doc.status,
      scheduledAt: doc.scheduledAt?.toISOString(),
      startedAt: doc.startedAt?.toISOString(),
      endedAt: doc.endedAt?.toISOString(),
      durationMinutes: durationMs !== undefined ? Math.round(durationMs / 60_000) : undefined,
      participantCount: stats?.participantCount ?? 0,
      averageParticipationScore: stats?.averageParticipationScore ?? 0,
    };
  }
}
