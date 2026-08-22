export const SCORING = {
  WEIGHTS: {
    ATTENDANCE: 0.30,
    CHAT: 0.20,
    SPEAKING: 0.25,
    HAND_RAISE: 0.15,
    REACTION: 0.10,
  },

  THRESHOLDS: {
    HIGH_ENGAGEMENT: 75,
    MEDIUM_ENGAGEMENT: 50,
    LOW_ENGAGEMENT: 25,
  },

  LABELS: {
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
    NONE: 'No Engagement',
  },

  ATTENDANCE: {
    FULL_CREDIT_RATIO: 0.90,
    PARTIAL_CREDIT_RATIO: 0.50,
  },

  CHAT: {
    MESSAGES_FOR_MAX_SCORE: 10,
  },

  SPEAKING: {
    SECONDS_FOR_MAX_SCORE: 120,
  },

  HAND_RAISE: {
    RAISES_FOR_MAX_SCORE: 5,
  },

  REACTION: {
    REACTIONS_FOR_MAX_SCORE: 10,
  },
} as const;

export type EngagementLevel = 'high' | 'medium' | 'low' | 'none';

export function getEngagementLevel(score: number): EngagementLevel {
  if (score >= SCORING.THRESHOLDS.HIGH_ENGAGEMENT) return 'high';
  if (score >= SCORING.THRESHOLDS.MEDIUM_ENGAGEMENT) return 'medium';
  if (score >= SCORING.THRESHOLDS.LOW_ENGAGEMENT) return 'low';
  return 'none';
}
