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

    const totalScore = interactions.reduce((sum, i) => sum + i.participationScore, 0);
    const averageScore = interactions.length > 0 ? Math.round(totalScore / interactions.length) : 0;

    return {
      meetingId: String(meeting._id),
      meetingTitle: meeting.title,
      startedAt: meeting.startedAt?.toISOString() ?? '',
      endedAt: meeting.endedAt?.toISOString(),
      durationMinutes: Math.round(durationMs / 60_000),
      totalParticipants: interactions.length,
      averageParticipationScore: averageScore,
      highEngagementCount: interactions.filter((i) => getEngagementLevel(i.participationScore) === 'high').length,
      mediumEngagementCount: interactions.filter((i) => getEngagementLevel(i.participationScore) === 'medium').length,
      lowEngagementCount: interactions.filter((i) => getEngagementLevel(i.participationScore) === 'low').length,
      participants: interactions.map((i) => ({
        participantId: String(i._id),
        displayName: i.displayName,
        attendanceDurationSeconds: i.attendanceDurationSeconds,
        chatMessageCount: i.chatMessageCount,
        handRaiseCount: i.handRaiseCount,
        reactionCount: i.reactionCount,
        speakingDurationSeconds: i.speakingDurationSeconds,
        participationScore: i.participationScore,
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
