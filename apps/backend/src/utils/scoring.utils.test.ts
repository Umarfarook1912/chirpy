import { describe, it, expect } from 'vitest';
import { calculateParticipationScore } from './scoring.utils';
import { SCORING } from '@chirpy/shared';
import type { SessionInteractionSummary } from '@chirpy/shared';

const SESSION_60_MIN = 3600;

function makeInteraction(overrides: Partial<SessionInteractionSummary> = {}): SessionInteractionSummary {
  return {
    displayName: 'Test User',
    attendanceDurationSeconds: 0,
    chatMessageCount: 0,
    handRaiseCount: 0,
    reactionCount: 0,
    speakingDurationSeconds: 0,
    ...overrides,
  };
}

describe('calculateParticipationScore', () => {
  it('returns 0 for completely inactive participant', () => {
    const score = calculateParticipationScore(makeInteraction(), SESSION_60_MIN);
    expect(score).toBe(0);
  });

  it('returns 100 for fully engaged participant', () => {
    const score = calculateParticipationScore(
      makeInteraction({
        attendanceDurationSeconds: SESSION_60_MIN,
        chatMessageCount: SCORING.CHAT.MESSAGES_FOR_MAX_SCORE,
        speakingDurationSeconds: SCORING.SPEAKING.SECONDS_FOR_MAX_SCORE,
        handRaiseCount: SCORING.HAND_RAISE.RAISES_FOR_MAX_SCORE,
        reactionCount: SCORING.REACTION.REACTIONS_FOR_MAX_SCORE,
      }),
      SESSION_60_MIN,
    );
    expect(score).toBe(100);
  });

  it('attendance-only participant gets partial score', () => {
    const score = calculateParticipationScore(
      makeInteraction({ attendanceDurationSeconds: SESSION_60_MIN }),
      SESSION_60_MIN,
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(50);
  });

  it('score is between 0 and 100', () => {
    const score = calculateParticipationScore(
      makeInteraction({
        attendanceDurationSeconds: 1800,
        chatMessageCount: 3,
        speakingDurationSeconds: 60,
      }),
      SESSION_60_MIN,
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns 0 when session duration is 0', () => {
    const score = calculateParticipationScore(
      makeInteraction({ attendanceDurationSeconds: 100 }),
      0,
    );
    expect(score).toBe(0);
  });

  it('caps chat score at max value', () => {
    const scoreAtMax = calculateParticipationScore(
      makeInteraction({ chatMessageCount: SCORING.CHAT.MESSAGES_FOR_MAX_SCORE }),
      SESSION_60_MIN,
    );
    const scoreOverMax = calculateParticipationScore(
      makeInteraction({ chatMessageCount: SCORING.CHAT.MESSAGES_FOR_MAX_SCORE * 10 }),
      SESSION_60_MIN,
    );
    expect(scoreAtMax).toBe(scoreOverMax);
  });
});
