import { db, type SyncQueueItem } from './db';

export class SyncQueueRepository {
  async enqueue(item: Omit<SyncQueueItem, 'id'>): Promise<number | undefined> {
    return db.syncQueue.add(item);
  }

  async getPending(): Promise<SyncQueueItem[]> {
    return db.syncQueue.where('status').equals('pending').toArray();
  }

  async markSyncing(id: number): Promise<void> {
    await db.syncQueue.update(id, { status: 'syncing', lastAttemptAt: Date.now() });
  }

  async markSynced(id: number, meetingId?: string): Promise<void> {
    await db.syncQueue.update(id, {
      status: 'synced',
      ...(meetingId ? { meetingId } : {}),
    });
  }

  async markFailed(id: number, error: string, retryCount: number): Promise<void> {
    await db.syncQueue.update(id, {
      status: retryCount >= 3 ? 'failed' : 'pending',
      error,
      retryCount,
      lastAttemptAt: Date.now(),
    });
  }

  async getByIdempotencyKey(key: string): Promise<SyncQueueItem | undefined> {
    return db.syncQueue.where('idempotencyKey').equals(key).first();
  }
}
