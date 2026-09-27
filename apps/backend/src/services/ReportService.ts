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
      if (/^\d+$/.test(name)) continue;
      if (name.length < 2 || name.length > 60) continue;
      if (/\.{2,}/.test(name)) continue;                             // "Getting ready..."
      if (/\bON$|\bOFF$/i.test(name)) continue;                     // "Video preview is ON"
      if (/^(return|go to|getting|turn on|turn off|open|close|share screen|mute\b|unmute\b)/i.test(name)) continue;
      if (/^more information/i.test(name)) continue;
      if (/^(about|participants?|people|keep pin|backgrounds?|captions?|screen sharing)\b/i.test(name)) continue;
      if (name.split(/\s+/).length > 5) continue;                   // Too many words → not a name
      // Detect doubled names without space: "Umar Farook JUmar Farook J"
      const half = Math.floor(name.length / 2);
      if (half > 3 && name.slice(0, half) === name.slice(half)) continue;

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

    // If "You" still exists as a row, absorb it into the participant who has
    // the most attendance (almost always the meeting host / local user).
    const youRow = merged.get('you');
    if (youRow) {
      merged.delete('you');
      // Find the real-name row with the highest attendance to absorb "You" into
      let bestKey = '';
      let bestAtt = -1;
      for (const [k, v] of merged) {
        if (v.attendanceDurationSeconds > bestAtt) { bestAtt = v.attendanceDurationSeconds; bestKey = k; }
      }
      if (bestKey) {
        const host = merged.get(bestKey)!;
        host.chatMessageCount        += youRow.chatMessageCount;
        host.handRaiseCount          += youRow.handRaiseCount;
        host.reactionCount           += youRow.reactionCount;
        host.speakingDurationSeconds += youRow.speakingDurationSeconds;
        host.attendanceDurationSeconds = Math.max(host.attendanceDurationSeconds, youRow.attendanceDurationSeconds);
      } else {
        // No real name at all — keep "You" renamed if only 1 participant total
        merged.set('you', { ...youRow, displayName: 'You' });
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
