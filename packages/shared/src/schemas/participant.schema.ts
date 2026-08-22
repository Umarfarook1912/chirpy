import { z } from 'zod';

export const ParticipantMetricsSchema = z.object({
  displayName: z.string().min(1).max(100).trim(),
  userId: z.string().optional(),
  attendanceDurationSeconds: z.number().int().min(0),
  chatMessageCount: z.number().int().min(0),
  handRaiseCount: z.number().int().min(0),
  reactionCount: z.number().int().min(0),
  speakingDurationSeconds: z.number().int().min(0),
});

export type ParticipantMetricsInput = z.infer<typeof ParticipantMetricsSchema>;
