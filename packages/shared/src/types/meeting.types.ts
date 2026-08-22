export type MeetingStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';
export type MeetingPlatform = 'google_meet' | 'teams' | 'zoom' | 'other';

export interface Meeting {
  id: string;
  organizationId: string;
  title: string;
  description?: string | undefined;
  platform: MeetingPlatform;
  externalMeetingId?: string | undefined;
  status: MeetingStatus;
  scheduledAt?: string | undefined;
  startedAt?: string | undefined;
  endedAt?: string | undefined;
  hostId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingSummary {
  id: string;
  title: string;
  platform: MeetingPlatform;
  status: MeetingStatus;
  scheduledAt?: string | undefined;
  startedAt?: string | undefined;
  endedAt?: string | undefined;
  durationMinutes?: number | undefined;
  participantCount: number;
  averageParticipationScore: number;
}
