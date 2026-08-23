import { InteractionModel } from '../models/Interaction.model';
import { SessionModel } from '../models/Session.model';
import { MeetingRepository } from '../repositories/MeetingRepository';
import { NotFoundError } from '../errors/NotFoundError';
import { AuthorizationError } from '../errors/AuthorizationError';
import { getEngagementLevel } from '@chirpy/shared';
import type { AuthTokenPayload, MeetingReport, OrganizationReport } from '@chirpy/shared';

const meetingRepo = new MeetingRepository();

export class ReportService {
  async getMeetingReport(user: AuthTokenPayload, meetingId: string): Promise<MeetingReport> {
    const meeting = await meetingRepo.findById(meetingId);
    if (!meeting) throw new NotFoundError('Meeting');
    if (String(meeting.organizationId) !== user.organizationId) throw new AuthorizationError();

    const sessions = await SessionModel.find({ meetingId }).exec();
    const sessionIds = sessions.map((s) => s._id);
    const interactions = await InteractionModel.find({ sessionId: { $in: sessionIds } }).exec();

    const durationMs =
      meeting.startedAt && meeting.endedAt
        ? meeting.endedAt.getTime() - meeting.startedAt.getTime()
        : 0;
    const meetingDurationSeconds = Math.max(1, Math.round(durationMs / 1_000));

    const merged = new Map<
      string,
      {
        displayName: string;
        attendanceDurationSeconds: number;
        chatMessageCount: number;
        handRaiseCount: number;
        reactionCount: number;
        speakingDurationSeconds: number;
        participationScore: number;
      }
    >();

    for (const i of interactions) {
      const name = i.displayName.trim();
      if (!name || /^Meet\b/i.test(name)) continue;
      if (/^\d+$/.test(name.trim())) continue;
      if (name.trim().length < 2) continue;

      const key = name.toLowerCase();
      const cappedAttendance = Math.min(i.attendanceDurationSeconds, meetingDurationSeconds);
      const existing = merged.get(key);

      if (existing) {
        existing.chatMessageCount += i.chatMessageCount;
        existing.handRaiseCount += i.handRaiseCount;
        existing.reactionCount += i.reactionCount;
        existing.speakingDurationSeconds += i.speakingDurationSeconds;
        existing.attendanceDurationSeconds = Math.max(
          existing.attendanceDurationSeconds,
          cappedAttendance,
        );
        existing.participationScore = Math.round(
          (existing.participationScore + i.participationScore) / 2,
        );
      } else {
        merged.set(key, {
          displayName: name,
          attendanceDurationSeconds: cappedAttendance,
          chatMessageCount: i.chatMessageCount,
          handRaiseCount: i.handRaiseCount,
          reactionCount: i.reactionCount,
          speakingDurationSeconds: i.speakingDurationSeconds,
          participationScore: i.participationScore,
        });
      }
    }

    const participants = Array.from(merged.values());
    const totalScore = participants.reduce((sum, p) => sum + p.participationScore, 0);
    const averageScore = participants.length > 0 ? Math.round(totalScore / participants.length) : 0;

    return {
      meetingId: String(meeting._id),
      meetingTitle: meeting.title,
      startedAt: meeting.startedAt?.toISOString() ?? '',
      endedAt: meeting.endedAt?.toISOString(),
      durationMinutes: Math.round(durationMs / 60_000),
      totalParticipants: participants.length,
      averageParticipationScore: averageScore,
      highEngagementCount: participants.filter((p) => getEngagementLevel(p.participationScore) === 'high').length,
      mediumEngagementCount: participants.filter((p) => getEngagementLevel(p.participationScore) === 'medium').length,
      lowEngagementCount: participants.filter((p) => getEngagementLevel(p.participationScore) === 'low').length,
      participants: participants.map((p) => ({
        participantId: p.displayName,
        displayName: p.displayName,
        attendanceDurationSeconds: p.attendanceDurationSeconds,
        chatMessageCount: p.chatMessageCount,
        handRaiseCount: p.handRaiseCount,
        reactionCount: p.reactionCount,
        speakingDurationSeconds: p.speakingDurationSeconds,
        participationScore: p.participationScore,
      })),
    };
  }

  async getOrganizationReport(
    user: AuthTokenPayload,
    periodStart: string,
    periodEnd: string,
  ): Promise<OrganizationReport> {
    const { meetings } = await meetingRepo.findByOrganization(user.organizationId, { limit: 100 });

    const summaries = await Promise.all(
      meetings.map(async (meeting) => {
        const sessions = await SessionModel.find({ meetingId: meeting._id }).exec();
        const sessionIds = sessions.map((s) => s._id);
        const interactions = await InteractionModel.find({ sessionId: { $in: sessionIds } }).exec();
        const totalScore = interactions.reduce((sum, i) => sum + i.participationScore, 0);
        const avgScore = interactions.length > 0 ? Math.round(totalScore / interactions.length) : 0;
        const durationMs =
          meeting.startedAt && meeting.endedAt
            ? meeting.endedAt.getTime() - meeting.startedAt.getTime()
            : 0;

        return {
          meetingId: String(meeting._id),
          title: meeting.title,
          date: (meeting.startedAt ?? meeting.createdAt).toISOString(),
          participantCount: interactions.length,
          averageScore: avgScore,
          durationMinutes: Math.round(durationMs / 60_000),
        };
      }),
    );

    const totalParticipants = summaries.reduce((sum, s) => sum + s.participantCount, 0);
    const totalScore = summaries.reduce((sum, s) => sum + s.averageScore, 0);
    const avgScore = summaries.length > 0 ? Math.round(totalScore / summaries.length) : 0;

    return {
      organizationId: user.organizationId,
      periodStart,
      periodEnd,
      totalMeetings: meetings.length,
      totalParticipants,
      averageParticipationScore: avgScore,
      meetingSummaries: summaries,
    };
  }
}
