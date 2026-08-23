import Dexie, { type EntityTable } from 'dexie';
import { EXTENSION_CONSTANTS } from '../constants/extension.constants';

if (typeof globalThis.indexedDB !== 'undefined') {
  Dexie.dependencies.indexedDB = globalThis.indexedDB;
  Dexie.dependencies.IDBKeyRange = globalThis.IDBKeyRange;
}

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
  meetingId?: string;
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

export interface StoredRecording {
  id?: number;
  recordingKey: string;
  sessionId: string;
  meetingTitle: string;
  mimeType: string;
  blob: Blob;
  createdAt: number;
}

class ChirpyDatabase extends Dexie {
  interactions!: EntityTable<LocalInteraction, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;
  sessions!: EntityTable<LocalSession, 'id'>;
  recordings!: EntityTable<StoredRecording, 'id'>;

  constructor() {
    super(EXTENSION_CONSTANTS.DB_NAME);
    this.version(1).stores({
      interactions: '++id, sessionId, type, timestamp',
      syncQueue: '++id, idempotencyKey, status, createdAt',
      sessions: '++id, sessionId, externalMeetingId, synced',
    });
    this.version(2).stores({
      interactions: '++id, sessionId, type, timestamp',
      syncQueue: '++id, idempotencyKey, status, createdAt',
      sessions: '++id, sessionId, externalMeetingId, synced',
      recordings: '++id, recordingKey, sessionId, createdAt',
    });
    this.version(EXTENSION_CONSTANTS.DB_VERSION).stores({
      interactions: '++id, sessionId, type, timestamp',
      syncQueue: '++id, idempotencyKey, status, createdAt, meetingId',
      sessions: '++id, sessionId, externalMeetingId, synced',
      recordings: '++id, recordingKey, sessionId, createdAt',
    });
  }
}

export const db = new ChirpyDatabase();
