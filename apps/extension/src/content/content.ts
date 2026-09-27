import { GoogleMeetAdapter, getSelfDisplayName } from './adapters/GoogleMeetAdapter';
import { RecordingOverlay } from './RecordingOverlay';
import { EXTENSION_CONSTANTS } from '../constants/extension.constants';
import type { MeetingInfo } from '../types/extension.types';
import type { RecordingStatus } from '@chirpy/shared';
import { isValidParticipantName, normalizeSelfName } from '../utils/blob.utils';

const recordingOverlay = new RecordingOverlay();

// ─── Interaction relay ─────────────────────────────────────────────────────

const pendingInteractionWrites: Promise<unknown>[] = [];

async function storeInteraction(interaction: {
  sessionId: string;
  participantName: string;
  type: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const participantName = normalizeSelfName(interaction.participantName, getSelfDisplayName());
  // Allow temporary "You" until real self name resolves; peers must still be valid names
  if (!isValidParticipantName(participantName) && !/^you$/i.test(participantName)) return;

  const write = chrome.runtime.sendMessage({
    type: 'STORE_INTERACTION',
    payload: { ...interaction, participantName },
  });
  pendingInteractionWrites.push(write);
  try {
    await write;
  } finally {
    const idx = pendingInteractionWrites.indexOf(write);
    if (idx >= 0) pendingInteractionWrites.splice(idx, 1);
  }
}

async function flushPendingInteractions(): Promise<void> {
  if (pendingInteractionWrites.length === 0) return;
  await Promise.allSettled([...pendingInteractionWrites]);
}

// ─── State ─────────────────────────────────────────────────────────────────

let adapter = new GoogleMeetAdapter();

let currentSessionId: string | null = null;
let currentMeeting: MeetingInfo | null = null;
let isEndingSession = false;
let ignoreRecordingUiUpdates = false;
let cleanupFns: Array<() => void> = [];
let meetPort: chrome.runtime.Port | null = null;
let sessionFinishedViaStop = false;
/** Ensures every currently-visible Meet participant has a join event before sync. */
let ensurePresenceSnapshot: (() => Promise<void>) | null = null;
/** Closes any open speaking segments before sync. */
let flushOpenSpeaking: (() => Promise<void>) | null = null;
/**
 * Best resolved self display name seen during the session.
 * Updated every time getSelfDisplayName() returns a real name (not "You").
 * Used at finish time so we don't fall back to "You" if the DOM has changed.
 */
let sessionSelfName = 'You';

function isValidParticipant(name: string): boolean {
  if (!isValidParticipantName(name)) return false;
  const meetingTitle = currentMeeting?.title ?? '';
  const externalId = currentMeeting?.externalMeetingId ?? '';
  if (meetingTitle && name.trim() === meetingTitle) return false;
  if (externalId && name.includes(externalId)) return false;
  return true;
}

// ─── Session lifecycle ─────────────────────────────────────────────────────

function endSession(_reason: string): void {
  const sessionId = currentSessionId;
  const meeting = currentMeeting;
  if (!sessionId || isEndingSession || sessionFinishedViaStop) return;

  isEndingSession = true;

  void (async () => {
    await ensurePresenceSnapshot?.();
    await flushOpenSpeaking?.();
    await flushPendingInteractions();
    const liveResolve = getSelfDisplayName();
    const selfDisplayName = (liveResolve && !/^you$/i.test(liveResolve)) ? liveResolve : sessionSelfName;

    stopTracking();

    meetPort?.postMessage({ type: 'SESSION_END', sessionId });
    meetPort?.disconnect();
    meetPort = null;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'MEETING_ENDED',
        payload: { sessionId, meeting: meeting ?? undefined, selfDisplayName },
      });
      if (response?.success) recordingOverlay.showSynced();
    } finally {
      isEndingSession = false;
    }
  })();
}

function startTracking(sessionId: string): void {
  currentSessionId = sessionId;

  // ── Participant join / leave tracking ──────────────────────────────────
  // Keys are lowercased; host/self joins at meeting.startedAt so late peers
  // do not inherit the same attendance as the host.
  const presentParticipants = new Set<string>();
  const joinTimestamps = new Map<string, number>();
  const displayByKey = new Map<string, string>();

  const resolveName = (raw: string): string =>
    normalizeSelfName(raw.trim(), getSelfDisplayName());

  let selfName = resolveName(getSelfDisplayName());
  if (selfName && !/^you$/i.test(selfName)) sessionSelfName = selfName;
  let selfKey = selfName.toLowerCase();
  const hostJoinAt = currentMeeting?.startedAt ?? Date.now();
  if (isValidParticipant(selfName) || /^you$/i.test(selfName)) {
    presentParticipants.add(selfKey);
    joinTimestamps.set(selfKey, hostJoinAt);
    displayByKey.set(selfKey, selfName);
    void storeInteraction({
      sessionId,
      participantName: selfName,
      type: 'join',
      timestamp: hostJoinAt,
    });
  }

  const applyPresence = (participants: Array<{ displayName: string }>) => {
    const now = Date.now();

    // If Meet later reveals the real self name, migrate the presence key
    const resolvedSelf = resolveName(getSelfDisplayName());
    if (resolvedSelf && !/^you$/i.test(resolvedSelf)) sessionSelfName = resolvedSelf;
    const resolvedKey = resolvedSelf.toLowerCase();
    if (resolvedKey !== selfKey && presentParticipants.has(selfKey)) {
      presentParticipants.delete(selfKey);
      presentParticipants.add(resolvedKey);
      joinTimestamps.set(resolvedKey, joinTimestamps.get(selfKey) ?? hostJoinAt);
      joinTimestamps.delete(selfKey);
      displayByKey.set(resolvedKey, resolvedSelf);
      displayByKey.delete(selfKey);
      selfKey = resolvedKey;
      selfName = resolvedSelf;
    } else if (resolvedKey !== selfKey) {
      selfKey = resolvedKey;
      selfName = resolvedSelf;
    }

    const incomingKeys = new Set<string>();
    const incomingDisplay = new Map<string, string>();

    for (const p of participants) {
      const name = resolveName(p.displayName);
      if (!isValidParticipant(name) && !/^you$/i.test(name)) continue;
      const key = name.toLowerCase();
      incomingKeys.add(key);
      incomingDisplay.set(key, name);
    }
    // Always treat self as present while tracking (avoids false leave when tile flickers)
    incomingKeys.add(selfKey);
    incomingDisplay.set(selfKey, selfName);

    // New arrivals → join (self already recorded at meeting.startedAt)
    for (const key of incomingKeys) {
      if (presentParticipants.has(key)) continue;
      const name = incomingDisplay.get(key)!;
      const isSelf = key === selfKey || /^you$/i.test(name);
      // First self join uses meeting start; rejoins use now
      const joinAt = isSelf && !joinTimestamps.has(key) ? hostJoinAt : now;
      presentParticipants.add(key);
      joinTimestamps.set(key, joinAt);
      displayByKey.set(key, name);
      void storeInteraction({ sessionId, participantName: name, type: 'join', timestamp: joinAt });
    }

    // Departures → leave (never auto-leave self while session is active)
    for (const key of [...presentParticipants]) {
      if (incomingKeys.has(key)) continue;
      if (key === selfKey) continue;
      presentParticipants.delete(key);
      const name = displayByKey.get(key) ?? key;
      const joinedAt = joinTimestamps.get(key) ?? now;
      const durationSeconds = Math.round((now - joinedAt) / 1_000);
      void storeInteraction({
        sessionId,
        participantName: name,
        type: 'leave',
        timestamp: now,
        metadata: { durationSeconds },
      });
    }
  };

  ensurePresenceSnapshot = async () => {
    applyPresence(adapter.getVisibleParticipants());
    await flushPendingInteractions();
  };

  cleanupFns.push(
    adapter.onParticipantChange((participants) => {
      applyPresence(participants);
    }),
  );

  // ── Chat ───────────────────────────────────────────────────────────────
  cleanupFns.push(
    adapter.onChatMessage((event) => {
      if (event.senderName === event.message) return;
      void storeInteraction({ sessionId, participantName: event.senderName, type: 'chat_message', timestamp: event.timestamp });
    }),
  );

  // ── Speaking (DOM indicators + mic unmute) ─────────────────────────────
  const speakingStartTimes = new Map<string, number>();

  const trackSpeaking = (participantName: string, speaking: boolean) => {
    const name = normalizeSelfName(participantName, getSelfDisplayName());
    const now = Date.now();
    if (speaking) {
      if (speakingStartTimes.has(name)) return;
      speakingStartTimes.set(name, now);
      void storeInteraction({ sessionId, participantName: name, type: 'speaking_start', timestamp: now });
    } else {
      const started = speakingStartTimes.get(name);
      if (started) {
        speakingStartTimes.delete(name);
        const durationSeconds = Math.max(1, Math.round((now - started) / 1_000));
        void storeInteraction({
          sessionId,
          participantName: name,
          type: 'speaking_end',
          timestamp: now,
          metadata: { durationSeconds },
        });
      }
    }
  };

  cleanupFns.push(adapter.onSpeakingChange(trackSpeaking));
  cleanupFns.push(adapter.onMicActivity(trackSpeaking));

  flushOpenSpeaking = async () => {
    const now = Date.now();
    for (const [name, started] of speakingStartTimes.entries()) {
      const durationSeconds = Math.max(1, Math.round((now - started) / 1_000));
      await storeInteraction({
        sessionId,
        participantName: name,
        type: 'speaking_end',
        timestamp: now,
        metadata: { durationSeconds },
      });
    }
    speakingStartTimes.clear();
  };

  // Flush any open speaking segment when the session ends
  cleanupFns.push(() => {
    for (const [name, started] of speakingStartTimes.entries()) {
      const durationSeconds = Math.max(1, Math.round((Date.now() - started) / 1_000));
      void storeInteraction({
        sessionId,
        participantName: name,
        type: 'speaking_end',
        timestamp: Date.now(),
        metadata: { durationSeconds },
      });
    }
    speakingStartTimes.clear();
  });

  // ── Hand raise ─────────────────────────────────────────────────────────
  cleanupFns.push(
    adapter.onHandRaise((participantName, timestamp) => {
      const resolvedSelf = getSelfDisplayName();
      if (resolvedSelf && !/^you$/i.test(resolvedSelf)) sessionSelfName = resolvedSelf;
      void storeInteraction({ sessionId, participantName, type: 'hand_raise', timestamp });
    }),
  );

  // ── Meeting end ────────────────────────────────────────────────────────
  cleanupFns.push(
    adapter.onMeetingEnd(() => { endSession('adapter-meeting-end'); }),
  );
}

function stopTracking(): void {
  for (const cleanup of cleanupFns) cleanup();
  cleanupFns = [];
  ensurePresenceSnapshot = null;
  flushOpenSpeaking = null;
  currentSessionId = null;
  currentMeeting = null;
  sessionSelfName = 'You';
  adapter.destroy();
  adapter = new GoogleMeetAdapter();
}

function initialize(meeting: MeetingInfo): void {
  currentMeeting = meeting;
  const sessionId = `${meeting.externalMeetingId}-${meeting.startedAt}`;

  void chrome.runtime.sendMessage({ type: 'MEETING_STARTED', payload: { sessionId, meeting } });

  meetPort = chrome.runtime.connect({ name: 'chirpy-meet' });
  meetPort.postMessage({ type: 'SESSION_BIND', sessionId });

  startTracking(sessionId);
}

function tryDetectMeeting(): void {
  if (window.location.hostname !== EXTENSION_CONSTANTS.GOOGLE_MEET_HOST) return;
  if (currentSessionId) return;
  const meeting = adapter.detectMeeting();
  if (!meeting) return;
  initialize(meeting);
}

function ensureMeetingSession(): void {
  tryDetectMeeting();
}

// ─── Recording stop handler ─────────────────────────────────────────────────

let pendingFinish: {
  meetingId: string;
  recordingKey?: string;
  meetingTitle: string;
} | null = null;

function applyFinishPanel(response: {
  meetingId?: string;
  recordingKey?: string;
  meetingTitle?: string;
}): void {
  const meetingTitle = response.meetingTitle ?? currentMeeting?.title ?? 'meeting';
  const panelData = {
    meetingId: response.meetingId ?? pendingFinish?.meetingId ?? '',
    recordingKey: response.recordingKey ?? pendingFinish?.recordingKey,
    meetingTitle,
    hasRecording: Boolean(response.recordingKey ?? pendingFinish?.recordingKey),
  };

  pendingFinish = panelData.meetingId || panelData.recordingKey
    ? { meetingId: panelData.meetingId, recordingKey: panelData.recordingKey, meetingTitle }
    : null;

  recordingOverlay.showDownloadPanel(panelData);
}

async function sendFinishMessage(sessionId: string, meeting: MeetingInfo | null): Promise<void> {
  // Capture every visible person and close speaking segments BEFORE sync,
  // otherwise the dashboard only sees the host row named "You".
  await ensurePresenceSnapshot?.();
  await flushOpenSpeaking?.();
  await flushPendingInteractions();

  // Prefer the name we cached during the session — getSelfDisplayName() may
  // return "You" if the Meet DOM has already changed by the time we stop.
  const liveResolve = getSelfDisplayName();
  const selfDisplayName = (liveResolve && !/^you$/i.test(liveResolve)) ? liveResolve : sessionSelfName;
  const messagePromise = chrome.runtime.sendMessage({
    type: 'FINISH_MEETING_SESSION',
    payload: {
      sessionId,
      meeting: meeting ?? undefined,
      suppressUi: true,
      selfDisplayName,
    },
  }) as Promise<{ success?: boolean; meetingId?: string; recordingKey?: string; error?: string }>;

  const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
    window.setTimeout(() => resolve({ success: false, error: 'Timed out — check download buttons shortly' }), 12_000);
  });

  const response = await Promise.race([messagePromise, timeoutPromise]);

  sessionFinishedViaStop = true;
  stopTracking();

  meetPort?.postMessage({ type: 'SESSION_END', sessionId });
  meetPort?.disconnect();
  meetPort = null;

  if (response?.recordingKey || response?.meetingId) {
    applyFinishPanel({
      meetingId: response.meetingId,
      recordingKey: response.recordingKey,
      meetingTitle: meeting?.title,
    });
  } else if (response?.error) {
    recordingOverlay.update('error', 0, response.error);
  } else {
    recordingOverlay.update('error', 0, 'Failed to finish session — reload extension and try again');
  }
}

function handleRecordingStop(): void {
  if (isEndingSession) return;

  const sessionId = currentSessionId;
  const meeting = currentMeeting;
  if (!sessionId) return;

  isEndingSession = true;
  ignoreRecordingUiUpdates = true;
  recordingOverlay.mount(handleRecordingStop);
  recordingOverlay.setStatusText('Saving recording…');
  recordingOverlay.clearTimer();
  recordingOverlay.hideStopButton();

  void (async () => {
    try {
      await sendFinishMessage(sessionId, meeting);
    } finally {
      isEndingSession = false;
    }
  })();
}

function showRecordingOverlay(status: RecordingStatus, elapsedSeconds: number, errorMessage?: string): void {
  recordingOverlay.mount(handleRecordingStop);
  recordingOverlay.update(status, elapsedSeconds, errorMessage);
}

// ─── Navigation monitoring ──────────────────────────────────────────────────

function watchMeetNavigation(): void {
  let lastHref = window.location.href;

  const check = () => {
    const href = window.location.href;
    if (href === lastHref) return;
    lastHref = href;
    if (currentSessionId && !EXTENSION_CONSTANTS.GOOGLE_MEET_URL_PATTERN.test(href)) {
      endSession('url-left-meeting');
      return;
    }
    if (!currentSessionId) tryDetectMeeting();
  };

  window.addEventListener('popstate', check);
  window.addEventListener('hashchange', check);
  window.addEventListener('pagehide', () => { endSession('pagehide'); });

  const observer = new MutationObserver(check);
  observer.observe(document.querySelector('title') ?? document.body, { childList: true, subtree: true, characterData: true });
}

function startMeetingDetectionPolling(): void {
  let attempts = 0;
  const intervalId = window.setInterval(() => {
    attempts += 1;
    if (currentSessionId || attempts > 60) {
      window.clearInterval(intervalId);
      return;
    }
    tryDetectMeeting();
  }, 2_000);
}

// ─── Message handler ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'PREPARE_RECORDING':
      ensureMeetingSession();
      sendResponse({
        success: true,
        sessionId: currentSessionId,
        meetingTitle: currentMeeting?.title ?? 'meeting',
      });
      return false;

    case 'RECORDING_UI_UPDATE': {
      const payload = message.payload as { status: RecordingStatus; elapsedSeconds: number; errorMessage?: string };
      if (!ignoreRecordingUiUpdates && payload.status !== 'completed' && payload.status !== 'idle') {
        showRecordingOverlay(payload.status, payload.elapsedSeconds, payload.errorMessage);
      }
      sendResponse({ success: true });
      return false;
    }

    case 'END_MEETING_SESSION':
      endSession((message.payload as { reason?: string } | undefined)?.reason ?? 'external-end');
      sendResponse({ success: true });
      return false;

    case 'TRIGGER_FINISH_UI':
      handleRecordingStop();
      sendResponse({ success: true });
      return false;

    case 'SESSION_FINISHED': {
      const payload = message.payload as {
        meetingId?: string;
        recordingKey?: string;
        meetingTitle?: string;
      };
      applyFinishPanel(payload);
      sendResponse({ success: true });
      return false;
    }

    case 'SESSION_SYNCED': {
      const payload = message.payload as { meetingId?: string; recordingKey?: string };
      applyFinishPanel({
        meetingId: payload.meetingId,
        recordingKey: payload.recordingKey,
        meetingTitle: currentMeeting?.title,
      });
      sendResponse({ success: true });
      return false;
    }

    default:
      return false;
  }
});

// ─── Boot ───────────────────────────────────────────────────────────────────

if (window.location.hostname === EXTENSION_CONSTANTS.GOOGLE_MEET_HOST) {
  const bootKey = '__chirpyMeetBooted';
  const win = window as unknown as Record<string, boolean>;
  if (!win[bootKey]) {
    win[bootKey] = true;
    tryDetectMeeting();
    watchMeetNavigation();
    startMeetingDetectionPolling();
  }
}
