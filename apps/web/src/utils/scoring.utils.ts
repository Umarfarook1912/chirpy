import { SCORING, getEngagementLevel } from '@chirpy/shared';
import type { EngagementLevel } from '@chirpy/shared';

export function getEngagementBadgeVariant(
  level: EngagementLevel,
): 'success' | 'primary' | 'warning' | 'error' | 'neutral' {
  switch (level) {
    case 'high':
      return 'success';
    case 'medium':
      return 'primary';
    case 'low':
      return 'warning';
    case 'none':
      return 'error';
  }
}

export function getEngagementLabel(score: number): string {
  const level = getEngagementLevel(score);
  return SCORING.LABELS[level.toUpperCase() as keyof typeof SCORING.LABELS];
}

export function getScoreColor(score: number): string {
  if (score >= SCORING.THRESHOLDS.HIGH_ENGAGEMENT) return 'var(--color-success)';
  if (score >= SCORING.THRESHOLDS.MEDIUM_ENGAGEMENT) return 'var(--color-primary)';
  if (score >= SCORING.THRESHOLDS.LOW_ENGAGEMENT) return 'var(--color-warning)';
  return 'var(--color-error)';
}
