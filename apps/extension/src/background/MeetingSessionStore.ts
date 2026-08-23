import type { MeetingInfo } from '../types/extension.types';

export interface StoredMeetingSession {
  sessionId: string;
  meeting: MeetingInfo;
  tabId?: number;
}

const storageKey = (sessionId: string) => `chirpy:session:${sessionId}`;

export async function saveMeetingSession(session: StoredMeetingSession): Promise<void> {
  await chrome.storage.local.set({ [storageKey(session.sessionId)]: session });
}

export async function getMeetingSession(sessionId: string): Promise<StoredMeetingSession | null> {
  const result = await chrome.storage.local.get(storageKey(sessionId));
  return (result[storageKey(sessionId)] as StoredMeetingSession | undefined) ?? null;
}

export async function listActiveMeetingSessions(): Promise<StoredMeetingSession[]> {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([key]) => key.startsWith('chirpy:session:'))
    .map(([, value]) => value as StoredMeetingSession);
}

export async function removeMeetingSession(sessionId: string): Promise<void> {
  await chrome.storage.local.remove(storageKey(sessionId));
}

export async function getSessionsForTab(tabId: number): Promise<StoredMeetingSession[]> {
  const sessions = await listActiveMeetingSessions();
  return sessions.filter((s) => s.tabId === tabId);
}
