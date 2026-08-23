import { GoogleMeetAdapter } from './adapters/GoogleMeetAdapter';
import { RecordingOverlay } from './RecordingOverlay';
import { EXTENSION_CONSTANTS } from '../constants/extension.constants';
import { debugLog } from '../utils/debugLog';
import type { MeetingInfo } from '../types/extension.types';
import type { RecordingStatus } from '@chirpy/shared';
import { isValidParticipantName, normalizeSelfName } from '../utils/blob.utils';

const recordingOverlay = new RecordingOverlay();

// ─── Interaction relay ─────────────────────────────────────────────────────

function getSelfDisplayName(): string {
  const self = document.querySelector('[data-self-name][data-is-self], [data-self-name]');
  return self?.getAttribute('data-self-name')?.trim() ?? 'You';
}

async function storeInteraction(interaction: {
  sessionId: string;
  participantName: string;
  type: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const participantName = normalizeSelfName(interaction.participantName, getSelfDisplayName());
  if (!isValidParticipantName(participantName)) return;
  await chrome.runtime.sendMessage({
    type: 'STORE_INTERACTION',
    payload: { ...interaction, participantName },
  });
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

function isValidParticipant(name: string): boolean {
  if (!isValidParticipantName(name)) return false;
  const meetingTitle = currentMeeting?.title ?? '';
  const externalId = currentMeeting?.externalMeetingId ?? '';
  if (meetingTitle && name.trim() === meetingTitle) return false;
  if (externalId && name.includes(externalId)) return false;
  return true;
}

// ─── Session lifecycle ─────────────────────────────────────────────────────

function endSession(reason: string): void {
  const sessionId = currentSessionId;
  const meeting = currentMeeting;
  if (!sessionId || isEndingSession || sessionFinishedViaStop) return;

  isEndingSession = true;
  stopTracking();

  meetPort?.postMessage({ type: 'SESSION_END', sessionId });
  meetPort?.disconnect();
  meetPort = null;

  void chrome.runtime
    .sendMessage({
      type: 'MEETING_ENDED',
      payload: { sessionId, meeting: meeting ?? undefined },
    })
    .then((response) => {
      if (response?.success) recordingOverlay.showSynced();
    })
    .finally(() => { isEndingSession = false; });
}

function startTracking(sessionId: string): void {
  currentSessionId = sessionId;

  // ── Participant join / leave tracking ──────────────────────────────────
  // Keep the current set so we can emit leave events when someone disappears.
  const presentParticipants = new Set<string>();
  const joinTimestamps = new Map<string, number>();

  cleanupFns.push(
    adapter.onParticipantChange((participants) => {
      const now = Date.now();
      const incoming = new Set(
        participants
          .map((p) => p.displayName.trim())
          .filter((n) => isValidParticipant(n)),
      );

      // New arrivals → join
      for (const name of incoming) {
        if (!presentParticipants.has(name)) {
          presentParticipants.add(name);
          joinTimestamps.set(name, now);
          void storeInteraction({ sessionId, participantName: name, type: 'join', timestamp: now });
          debugLog('content.ts:join', 'participant joined', { name }, 'H-participants');
        }
      }

      // Departures → leave
      for (const name of presentParticipants) {
        if (!incoming.has(name)) {
          presentParticipants.delete(name);
          const joinedAt = joinTimestamps.get(name) ?? now;
          const durationSeconds = Math.round((now - joinedAt) / 1_000);
          void storeInteraction({
            sessionId,
            participantName: name,
            type: 'leave',
            timestamp: now,
            metadata: { durationSeconds },
          });
          debugLog('content.ts:leave', 'participant left', { name, durationSeconds }, 'H-participants');
        }
      }
    }),
  );

  // ── Chat ───────────────────────────────────────────────────────────────
  cleanupFns.push(
    adapter.onChatMessage((event) => {
      if (event.senderName === event.message) return;
      debugLog('content.ts:onChatMessage', 'chat captured', { senderName: event.senderName, message: event.message.slice(0, 40) }, 'H-chat');
      void storeInteraction({ sessionId, participantName: event.senderName, type: 'chat_message', timestamp: event.timestamp });
    }),
  );

  // ── Speaking (DOM indicators + mic unmute) ─────────────────────────────
  const speakingStartTimes = new Map<string, number>();

  const trackSpeaking = (participantName: string, speaking: boolean) => {
    const now = Date.now();
    if (speaking) {
      if (speakingStartTimes.has(participantName)) return;
      speakingStartTimes.set(participantName, now);
      void storeInteraction({ sessionId, participantName, type: 'speaking_start', timestamp: now });
    } else {
      const started = speakingStartTimes.get(participantName);
      if (started) {
        speakingStartTimes.delete(participantName);
        const durationSeconds = Math.max(1, Math.round((now - started) / 1_000));
        void storeInteraction({
          sessionId,
          participantName,
          type: 'speaking_end',
          timestamp: now,
          metadata: { durationSeconds },
        });
      }
    }
  };

  cleanupFns.push(adapter.onSpeakingChange(trackSpeaking));
  cleanupFns.push(adapter.onMicActivity(trackSpeaking));

  // ── Hand raise ─────────────────────────────────────────────────────────
  cleanupFns.push(
    adapter.onHandRaise((participantName, timestamp) => {
      debugLog('content.ts:handRaise', 'hand raised', { participantName }, 'H-interaction');
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
  currentSessionId = null;
  currentMeeting = null;
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
  const messagePromise = chrome.runtime.sendMessage({
    type: 'FINISH_MEETING_SESSION',
    payload: { sessionId, meeting: meeting ?? undefined, suppressUi: true },
  }) as Promise<{ success?: boolean; meetingId?: string; recordingKey?: string; error?: string }>;

  const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
    window.setTimeout(() => resolve({ success: false, error: 'Timed out — check download buttons shortly' }), 12_000);
  });

  const response = await Promise.race([messagePromise, timeoutPromise]);

  debugLog('content.ts:handleRecordingStop', 'finish response', {
    success: response?.success ?? false,
    meetingId: response?.meetingId ?? null,
    recordingKey: response?.recordingKey ?? null,
    error: response?.error ?? null,
  }, 'H-recording');

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
