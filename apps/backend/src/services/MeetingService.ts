import { MeetingRepository } from '../repositories/MeetingRepository';
import { NotFoundError } from '../errors/NotFoundError';
import { AuthorizationError } from '../errors/AuthorizationError';
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

    return {
      meetings: meetings.map((m) => this.toSummary(m)),
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

  private toSummary(doc: MeetingDocument): MeetingSummary {
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
      participantCount: 0,
      averageParticipationScore: 0,
    };
  }
}
