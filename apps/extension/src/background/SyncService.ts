import type { SessionSyncInput } from '@chirpy/shared';
import { SyncQueueRepository } from '../db/SyncQueueRepository';
import { EXTENSION_CONSTANTS } from '../constants/extension.constants';
import { getSyncAuthHeaders } from './authHeaders';

const syncQueueRepo = new SyncQueueRepository();

function meetingIdStorageKey(externalMeetingId: string, startedAt?: string | number): string {
  if (startedAt !== undefined) {
    return `chirpy:meetingId:${externalMeetingId}:${startedAt}`;
  }
  return `chirpy:meetingId:${externalMeetingId}:latest`;
}

export async function cacheMeetingId(
  externalMeetingId: string,
  meetingId: string,
  startedAt?: string | number,
): Promise<void> {
  await chrome.storage.local.set({
    [meetingIdStorageKey(externalMeetingId, startedAt)]: meetingId,
    [meetingIdStorageKey(externalMeetingId)]: meetingId,
  });
}

export async function getCachedMeetingId(
  externalMeetingId: string,
  startedAt?: string | number,
): Promise<string | undefined> {
  const key = meetingIdStorageKey(externalMeetingId, startedAt);
  const result = await chrome.storage.local.get(key);
  return result[key] as string | undefined;
}

export async function lookupMeetingIdByExternal(externalMeetingId: string): Promise<string | undefined> {
  try {
    const authHeaders = await getSyncAuthHeaders();
    const response = await fetch(
      `${EXTENSION_CONSTANTS.API_BASE_URL}/meetings/lookup?externalMeetingId=${encodeURIComponent(externalMeetingId)}`,
      { headers: { ...authHeaders } },
    );

    if (!response.ok) return undefined;

    const body = (await response.json()) as { data?: { meetingId?: string } };
    const meetingId = body.data?.meetingId;
    if (meetingId) {
      await cacheMeetingId(externalMeetingId, meetingId);
    }
    return meetingId;
  } catch {
    return undefined;
  }
}

export async function syncSessionPayload(payload: SessionSyncInput): Promise<string | undefined> {
  try {
    const authHeaders = await getSyncAuthHeaders();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    let response = await fetch(`${EXTENSION_CONSTANTS.API_BASE_URL}/sessions/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(payload),
      credentials: 'include',
      signal: controller.signal,
    });

    if (response.status === 401) {
      const refreshedHeaders = await getSyncAuthHeaders();
      if (refreshedHeaders.Authorization) {
        response = await fetch(`${EXTENSION_CONSTANTS.API_BASE_URL}/sessions/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...refreshedHeaders },
          body: JSON.stringify(payload),
          credentials: 'include',
          signal: controller.signal,
        });
      }
    }

    clearTimeout(timeout);

    const body = (await response.json()) as {
      data?: { meetingId?: string; message?: string };
      error?: { message?: string };
      success?: boolean;
    };

    const meetingId = body.data?.meetingId;

    if (response.ok && meetingId) {
      await cacheMeetingId(payload.externalMeetingId, meetingId, payload.startedAt);
      const existing = await syncQueueRepo.getByIdempotencyKey(payload.idempotencyKey);
      if (existing?.id) {
        await syncQueueRepo.markSynced(existing.id, meetingId);
      }
      return meetingId;
    }

    if (response.ok && !meetingId) {
      const cached = await getCachedMeetingId(payload.externalMeetingId, payload.startedAt);
      if (cached) return cached;
      return lookupMeetingIdByExternal(payload.externalMeetingId);
    }

    return lookupMeetingIdByExternal(payload.externalMeetingId);
  } catch {
    return lookupMeetingIdByExternal(payload.externalMeetingId);
  }
}

export class SyncService {
  private isSyncing = false;

  async processPendingItems(): Promise<string | undefined> {
    if (this.isSyncing) return undefined;
    this.isSyncing = true;

    let meetingId: string | undefined;

    try {
      const pending = await syncQueueRepo.getPending();

      for (const item of pending) {
        if (!item.id) continue;

        await syncQueueRepo.markSyncing(item.id);

        try {
          const payload = JSON.parse(item.payload) as SessionSyncInput;
          const syncedMeetingId = await syncSessionPayload(payload);
          if (syncedMeetingId) {
            meetingId = syncedMeetingId;
          } else {
            const error = 'Sync failed';
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

    return meetingId;
  }
}
