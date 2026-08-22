import { z } from 'zod';

const MeetingPlatformEnum = z.enum(['google_meet', 'teams', 'zoom', 'other']);
const MeetingStatusEnum = z.enum(['scheduled', 'active', 'completed', 'cancelled']);

export const CreateMeetingSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters')
    .trim(),
  description: z.string().max(1000, 'Description must be at most 1000 characters').trim().optional(),
  platform: MeetingPlatformEnum.default('google_meet'),
  externalMeetingId: z.string().max(200).trim().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export const UpdateMeetingSchema = CreateMeetingSchema.partial().extend({
  status: MeetingStatusEnum.optional(),
});

export const MeetingQuerySchema = z.object({
  status: MeetingStatusEnum.optional(),
  platform: MeetingPlatformEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateMeetingInput = z.infer<typeof CreateMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof UpdateMeetingSchema>;
export type MeetingQueryInput = z.infer<typeof MeetingQuerySchema>;
