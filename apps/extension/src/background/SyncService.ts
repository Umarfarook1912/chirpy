import { SyncQueueRepository } from '../db/SyncQueueRepository';
import { EXTENSION_CONSTANTS } from '../constants/extension.constants';

const syncQueueRepo = new SyncQueueRepository();

export class SyncService {
  private isSyncing = false;

  async processPendingItems(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const pending = await syncQueueRepo.getPending();

      for (const item of pending) {
        if (!item.id) continue;

        await syncQueueRepo.markSyncing(item.id);

        try {
          const response = await fetch(`${EXTENSION_CONSTANTS.API_BASE_URL}/sessions/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: item.payload,
            credentials: 'include',
          });

          if (response.ok) {
            await syncQueueRepo.markSynced(item.id);
          } else if (response.status === 409) {
            await syncQueueRepo.markSynced(item.id);
          } else {
            const error = `HTTP ${response.status}`;
            await syncQueueRepo.markFailed(item.id, error, item.retryCount + 1);
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Network error';
          await syncQueueRepo.markFailed(item.id, error, item.retryCount + 1);
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }
}
