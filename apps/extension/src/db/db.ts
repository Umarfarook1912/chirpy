import Dexie, { type EntityTable } from 'dexie';
import { EXTENSION_CONSTANTS } from '../constants/extension.constants';

export interface LocalInteraction {
  id?: number;
  sessionId: string;
  participantName: string;
  type: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface SyncQueueItem {
  id?: number;
  idempotencyKey: string;
  payload: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  createdAt: number;
  lastAttemptAt?: number;
  error?: string;
}

export interface LocalSession {
  id?: number;
  sessionId: string;
  externalMeetingId: string;
  meetingTitle: string;
  platform: string;
  startedAt: number;
  endedAt?: number;
  synced: boolean;
}

class ChirpyDatabase extends Dexie {
  interactions!: EntityTable<LocalInteraction, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;
  sessions!: EntityTable<LocalSession, 'id'>;

  constructor() {
    super(EXTENSION_CONSTANTS.DB_NAME);
    this.version(EXTENSION_CONSTANTS.DB_VERSION).stores({
      interactions: '++id, sessionId, type, timestamp',
      syncQueue: '++id, idempotencyKey, status, createdAt',
      sessions: '++id, sessionId, externalMeetingId, synced',
    });
  }
}

export const db = new ChirpyDatabase();
