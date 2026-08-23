const SYNCED_KEYS_STORAGE = 'chirpy:syncedIdempotencyKeys';

export async function markIdempotencySynced(idempotencyKey: string): Promise<void> {
  const result = await chrome.storage.session.get(SYNCED_KEYS_STORAGE);
  const keys = new Set<string>((result[SYNCED_KEYS_STORAGE] as string[] | undefined) ?? []);
  keys.add(idempotencyKey);
  await chrome.storage.session.set({ [SYNCED_KEYS_STORAGE]: [...keys] });
}

export async function isIdempotencySynced(idempotencyKey: string): Promise<boolean> {
  const result = await chrome.storage.session.get(SYNCED_KEYS_STORAGE);
  const keys = (result[SYNCED_KEYS_STORAGE] as string[] | undefined) ?? [];
  return keys.includes(idempotencyKey);
}

export async function markSessionFinished(sessionId: string): Promise<void> {
  const key = `chirpy:finished:${sessionId}`;
  await chrome.storage.session.set({ [key]: true });
}

export async function isSessionFinished(sessionId: string): Promise<boolean> {
  const key = `chirpy:finished:${sessionId}`;
  const result = await chrome.storage.session.get(key);
  return Boolean(result[key]);
}
