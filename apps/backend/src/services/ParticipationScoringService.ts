import { SCORING, getEngagementLevel } from '@chirpy/shared';
import type { SessionSyncInput, ParticipantMetrics, EngagementLevel } from '@chirpy/shared';
import { calculateParticipationScore } from '../utils/scoring.utils';

export interface ScoredParticipant extends ParticipantMetrics {
  participationScore: number;
  engagementLevel: EngagementLevel;
}

export interface SessionScore {
  participants: ScoredParticipant[];
  averageScore: number;
  highEngagementCount: number;
  mediumEngagementCount: number;
  lowEngagementCount: number;
  noneEngagementCount: number;
}

export class ParticipationScoringService {
  scoreSession(payload: SessionSyncInput): SessionScore {
    const startedAt = new Date(payload.startedAt).getTime();
    const endedAt = new Date(payload.endedAt).getTime();
    const sessionDurationSeconds = Math.max(0, (endedAt - startedAt) / 1_000);

    const participants: ScoredParticipant[] = payload.interactions.map((interaction) => {
      const participationScore = calculateParticipationScore(interaction, sessionDurationSeconds);
      const engagementLevel = getEngagementLevel(participationScore);

      return {
        participantId: '',
        displayName: interaction.displayName,
        attendanceDurationSeconds: interaction.attendanceDurationSeconds,
        chatMessageCount: interaction.chatMessageCount,
        handRaiseCount: interaction.handRaiseCount,
        reactionCount: interaction.reactionCount,
        speakingDurationSeconds: interaction.speakingDurationSeconds,
        participationScore,
        engagementLevel,
      };
    });

    const totalScore = participants.reduce((sum, p) => sum + p.participationScore, 0);
    const averageScore = participants.length > 0 ? Math.round(totalScore / participants.length) : 0;

    const counts = this.countByEngagementLevel(participants);

    return { participants, averageScore, ...counts };
  }

  private countByEngagementLevel(participants: ScoredParticipant[]) {
    let highEngagementCount = 0;
    let mediumEngagementCount = 0;
    let lowEngagementCount = 0;
    let noneEngagementCount = 0;

    for (const p of participants) {
      if (p.participationScore >= SCORING.THRESHOLDS.HIGH_ENGAGEMENT) highEngagementCount++;
      else if (p.participationScore >= SCORING.THRESHOLDS.MEDIUM_ENGAGEMENT) mediumEngagementCount++;
      else if (p.participationScore >= SCORING.THRESHOLDS.LOW_ENGAGEMENT) lowEngagementCount++;
      else noneEngagementCount++;
    }

    return { highEngagementCount, mediumEngagementCount, lowEngagementCount, noneEngagementCount };
  }
}
