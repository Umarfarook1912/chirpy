import { z } from 'zod';
import { ParticipantMetricsSchema } from './participant.schema';

export const SessionSyncSchema = z.object({
  idempotencyKey: z
    .string()
    .uuid('idempotencyKey must be a valid UUID'),
  externalMeetingId: z
    .string()
    .min(1, 'externalMeetingId is required')
    .max(200),
  platform: z.enum(['google_meet', 'teams', 'zoom', 'other']),
  meetingTitle: z
    .string()
    .min(1, 'meetingTitle is required')
    .max(200)
    .trim(),
  startedAt: z.string().datetime('startedAt must be a valid ISO 8601 datetime'),
  endedAt: z.string().datetime('endedAt must be a valid ISO 8601 datetime'),
  interactions: z
    .array(ParticipantMetricsSchema)
    .min(1, 'At least one participant interaction is required')
    .max(500, 'Too many participants in a single session'),
});

export type SessionSyncInput = z.infer<typeof SessionSyncSchema>;
