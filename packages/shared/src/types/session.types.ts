export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface Session {
  id: string;
  meetingId: string;
  organizationId: string;
  startedAt: string;
  endedAt?: string | undefined;
  durationSeconds: number;
  syncStatus: SyncStatus;
  syncedAt?: string | undefined;
  idempotencyKey: string;
  createdAt: string;
}

export interface SessionSyncPayload {
  idempotencyKey: string;
  externalMeetingId: string;
  platform: string;
  meetingTitle: string;
  startedAt: string;
  endedAt: string;
  interactions: SessionInteractionSummary[];
}

export interface SessionInteractionSummary {
  displayName: string;
  userId?: string | undefined;
  attendanceDurationSeconds: number;
  chatMessageCount: number;
  handRaiseCount: number;
  reactionCount: number;
  speakingDurationSeconds: number;
}
