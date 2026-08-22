import { SCORING } from '@chirpy/shared';
import type { SessionInteractionSummary } from '@chirpy/shared';

export function calculateParticipationScore(
  interaction: SessionInteractionSummary,
  sessionDurationSeconds: number,
): number {
  const attendanceScore = calculateAttendanceScore(
    interaction.attendanceDurationSeconds,
    sessionDurationSeconds,
  );
  const chatScore = calculateChatScore(interaction.chatMessageCount);
  const speakingScore = calculateSpeakingScore(interaction.speakingDurationSeconds);
  const handRaiseScore = calculateHandRaiseScore(interaction.handRaiseCount);
  const reactionScore = calculateReactionScore(interaction.reactionCount);

  const weightedScore =
    attendanceScore * SCORING.WEIGHTS.ATTENDANCE +
    chatScore * SCORING.WEIGHTS.CHAT +
    speakingScore * SCORING.WEIGHTS.SPEAKING +
    handRaiseScore * SCORING.WEIGHTS.HAND_RAISE +
    reactionScore * SCORING.WEIGHTS.REACTION;

  return Math.round(Math.min(100, Math.max(0, weightedScore * 100)));
}

function calculateAttendanceScore(attendanceSeconds: number, sessionSeconds: number): number {
  if (sessionSeconds <= 0) return 0;
  const ratio = attendanceSeconds / sessionSeconds;
  if (ratio >= SCORING.ATTENDANCE.FULL_CREDIT_RATIO) return 1;
  if (ratio >= SCORING.ATTENDANCE.PARTIAL_CREDIT_RATIO) return ratio;
  return ratio * 0.5;
}

function calculateChatScore(count: number): number {
  return Math.min(1, count / SCORING.CHAT.MESSAGES_FOR_MAX_SCORE);
}

function calculateSpeakingScore(seconds: number): number {
  return Math.min(1, seconds / SCORING.SPEAKING.SECONDS_FOR_MAX_SCORE);
}

function calculateHandRaiseScore(count: number): number {
  return Math.min(1, count / SCORING.HAND_RAISE.RAISES_FOR_MAX_SCORE);
}

function calculateReactionScore(count: number): number {
  return Math.min(1, count / SCORING.REACTION.REACTIONS_FOR_MAX_SCORE);
}
