import { SyncService } from './SyncService';
import type { ExtensionMessage, MeetingInfo } from '../types/extension.types';
import { EXTENSION_CONSTANTS } from '../constants/extension.constants';
import { debugLog, writeDebugLog } from '../utils/debugLog';
import {
  getSessionsForTab,
  listActiveMeetingSessions,
  saveMeetingSession,
} from './MeetingSessionStore';
import { enqueueAndSyncSession } from './SessionSyncOrchestrator';
import { isSessionFinished } from './SyncedSessionStore';
import { lookupMeetingIdByExternal } from './SyncService';
import { RecordingRepository } from '../db/RecordingRepository';
import { InteractionRepository } from '../db/InteractionRepository';
import { blobToDataUrl, blobToBase64Chunks, sanitizeDownloadFilename } from '../utils/blob.utils';
import {
  getActiveRecording,
  handleRecordingStateChanged,
  prepareRecordingTab,
  startRecording,
  stopRecording,
} from './RecordingManager';

const syncService = new SyncService();
const interactionRepo = new InteractionRepository();
const meetTabIds = new Set<number>();

function scheduleBackgroundSync(): void {
  if (!chrome.alarms?.create) {
    console.warn('[CHIRPY] Alarms API unavailable — periodic sync disabled');
    return;
  }

  chrome.alarms.create('chirpy-sync', { periodInMinutes: 5 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'chirpy-sync') {
      void syncService.processPendingItems();
    }
  });
}

async function injectContentScriptsIntoMeetTabs(): Promise<void> {
  const manifest = chrome.runtime.getManifest();
  const scriptFiles = manifest.content_scripts?.flatMap((cs) => cs.js ?? []) ?? [];
  if (scriptFiles.length === 0) return;

  const tabs = await chrome.tabs.query({ url: 'https://meet.google.com/*' });

  for (const tab of tabs) {
    if (!tab.id) continue;
    for (const file of scriptFiles) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [file],
        });
      } catch {
        /* tab may not permit injection */
      }
    }
  }
}

async function syncSessionsForTab(tabId: number, isMeetTab: boolean): Promise<void> {
  let sessions = await getSessionsForTab(tabId);

  if (sessions.length === 0 && isMeetTab) {
    sessions = await listActiveMeetingSessions();
  }

  for (const session of sessions) {
    await enqueueAndSyncSession(session.sessionId);
  }
}

scheduleBackgroundSync();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'chirpy-meet') return;

  let sessionId: string | null = null;
  let sessionEnded = false;

  port.onMessage.addListener((msg: { type: string; sessionId?: string }) => {
    if (msg.type === 'SESSION_BIND' && msg.sessionId) {
      sessionId = msg.sessionId;
    }
    if (msg.type === 'SESSION_END') {
      sessionEnded = true;
    }
  });

  port.onDisconnect.addListener(() => {
    if (sessionId && !sessionEnded) {
      void isSessionFinished(sessionId).then((finished) => {
        if (!finished) {
          void enqueueAndSyncSession(sessionId);
        }
      });
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url ?? tab.url;
  if (url?.includes('meet.google.com')) {
    meetTabIds.add(tabId);
  } else if (url && !url.includes('meet.google.com')) {
    meetTabIds.delete(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const wasMeetTab = meetTabIds.delete(tabId);
  void syncSessionsForTab(tabId, wasMeetTab);
});

function onExtensionReady(): void {
  void injectContentScriptsIntoMeetTabs();
}

chrome.runtime.onInstalled.addListener(onExtensionReady);
chrome.runtime.onStartup.addListener(onExtensionReady);

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse): boolean => {
    switch (message.type) {
      case 'MEETING_STARTED': {
        const payload = message.payload as { sessionId: string; meeting: MeetingInfo };
        const tabId = sender.tab?.id;
        if (tabId !== undefined) {
          meetTabIds.add(tabId);
        }
        void saveMeetingSession({
          sessionId: payload.sessionId,
          meeting: payload.meeting,
          tabId,
        });
        sendResponse({ success: true });
        return false;
      }

      case 'MEETING_ENDED': {
        const payload = message.payload as { sessionId: string; meeting?: MeetingInfo };
        const tabId = sender.tab?.id;
        void (async () => {
          if (await isSessionFinished(payload.sessionId)) {
            sendResponse({ success: true, skipped: true });
            return;
          }
          if (payload.meeting) {
            await saveMeetingSession({
              sessionId: payload.sessionId,
              meeting: payload.meeting,
              tabId,
            });
          }
          const meetingId = await enqueueAndSyncSession(payload.sessionId, payload.meeting);
          sendResponse({ success: true, meetingId });
        })();
        return true;
      }

      case 'RECORDING_START': {
        const payload = message.payload as { tabId: number; meetingTitle?: string };
        void (async () => {
          try {
            const { meetingTitle, sessionId } = await prepareRecordingTab(payload.tabId);
            await startRecording(
              payload.tabId,
              payload.meetingTitle ?? meetingTitle,
              sessionId,
            );
            sendResponse({ success: true });
          } catch (err) {
            sendResponse({
              success: false,
              error: err instanceof Error ? err.message : 'Failed to start recording',
            });
          }
        })();
        return true;
      }

      case 'RECORDING_STOP': {
        void (async () => {
          const state = await getActiveRecording();
          if (state?.tabId) {
            try {
              await chrome.tabs.sendMessage(state.tabId, {
                type: 'TRIGGER_FINISH_UI',
                payload: { reason: 'popup-stop' },
              });
              sendResponse({ success: true });
              return;
            } catch {
              /* fall through to direct stop */
            }
          }
          const result = await stopRecording({ syncSession: false, suppressUi: false });
          sendResponse({ success: true, recordingKey: result?.recordingKey });
        })();
        return true;
      }

      case 'RECORDING_GET_STATE': {
        void getActiveRecording().then((state) => {
          sendResponse({ success: true, state });
        });
        return true;
      }

      case 'RECORDING_STATE_CHANGED': {
        const payload = message.payload as {
          status: import('@chirpy/shared').RecordingStatus;
          elapsedSeconds: number;
          errorMessage?: string;
        };
        void handleRecordingStateChanged(payload).then(() => {
          sendResponse({ success: true });
        });
        return true;
      }

      case 'SYNC_SESSION':
        void syncService.processPendingItems().then(() => {
          sendResponse({ success: true });
        });
        return true;

      case 'OPEN_MEETING_TAB': {
        const payload = message.payload as { meetingId: string; recordingKey?: string };
        const url = new URL(
          `${EXTENSION_CONSTANTS.WEB_APP_URL}/meetings/${payload.meetingId}`,
        );
        if (payload.recordingKey) {
          url.searchParams.set('recording', payload.recordingKey);
        }
        writeDebugLog(
          'background.ts:OPEN_MEETING_TAB',
          'opening tab',
          { meetingId: payload.meetingId, recordingKey: payload.recordingKey ?? null },
          'H-nav',
        );
        void chrome.tabs.create({ url: url.toString() });
        sendResponse({ success: true });
        return false;
      }

      case 'FINISH_MEETING_SESSION': {
        const payload = message.payload as {
          sessionId: string;
          meeting?: MeetingInfo;
          suppressUi?: boolean;
        };
        const tabId = sender.tab?.id;

        void (async () => {
          try {
            if (payload.meeting) {
              await saveMeetingSession({
                sessionId: payload.sessionId,
                meeting: payload.meeting,
                tabId,
              });
            }

            const stopResult = await stopRecording({
              syncSession: false,
              suppressUi: payload.suppressUi ?? true,
            });
            const recordingKey = stopResult?.recordingKey;

            const cachedMeetingId = payload.meeting?.externalMeetingId
              ? await lookupMeetingIdByExternal(payload.meeting.externalMeetingId)
              : undefined;

            const finishPayload = {
              success: Boolean(recordingKey || cachedMeetingId),
              meetingId: cachedMeetingId,
              recordingKey,
              sessionId: payload.sessionId,
              meetingTitle: payload.meeting?.title ?? 'meeting',
            };

            sendResponse(finishPayload);

            if (tabId) {
              void chrome.tabs.sendMessage(tabId, {
                type: 'SESSION_FINISHED',
                payload: finishPayload,
              });
            }

            void (async () => {
              try {
                const meetingId = await enqueueAndSyncSession(payload.sessionId, payload.meeting);
                writeDebugLog(
                  'background.ts:FINISH_MEETING_SESSION',
                  'sync complete',
                  { sessionId: payload.sessionId, meetingId: meetingId ?? null, recordingKey: recordingKey ?? null },
                  'H-recording',
                );
                if (tabId && meetingId) {
                  void chrome.tabs.sendMessage(tabId, {
                    type: 'SESSION_SYNCED',
                    payload: { meetingId, recordingKey, sessionId: payload.sessionId },
                  });
                }
              } catch (syncErr) {
                writeDebugLog(
                  'background.ts:FINISH_MEETING_SESSION',
                  'sync failed',
                  { error: syncErr instanceof Error ? syncErr.message : 'unknown' },
                  'H-sync',
                );
              }
            })();
          } catch (err) {
            writeDebugLog(
              'background.ts:FINISH_MEETING_SESSION',
              'finish failed',
              { error: err instanceof Error ? err.message : 'unknown' },
              'H-sync',
            );
            sendResponse({
              success: false,
              error: err instanceof Error ? err.message : 'Failed to finish meeting',
            });
          }
        })();
        return true;
      }

      case 'DOWNLOAD_RECORDING': {
        const payload = message.payload as { recordingKey?: string; meetingTitle?: string };
        void (async () => {
          try {
            const repo = new RecordingRepository();
            const recording = payload.recordingKey
              ? await repo.getByKey(payload.recordingKey)
              : await repo.getLatest();
            if (!recording) {
              sendResponse({ success: false, error: 'Recording not found in local storage. Try reloading the extension.' });
              return;
            }
            if (!recording.blob || recording.blob.size === 0) {
              sendResponse({ success: false, error: 'Recording blob is empty' });
              return;
            }
            const dataUrl = await blobToDataUrl(recording.blob);
            const filename = sanitizeDownloadFilename(
              payload.meetingTitle ?? recording.meetingTitle ?? 'meeting',
              'webm',
            );
            writeDebugLog(
              'background.ts:DOWNLOAD_RECORDING',
              'download prepared',
              { recordingKey: recording.recordingKey, blobSize: recording.blob.size, mimeType: recording.mimeType },
              'H-recording',
            );
            await chrome.downloads.download({ url: dataUrl, filename, saveAs: true });
            sendResponse({ success: true, filename, downloaded: true });
          } catch (err) {
            sendResponse({
              success: false,
              error: err instanceof Error ? err.message : 'Download failed',
            });
          }
        })();
        return true;
      }

      case 'STORE_INTERACTION': {
        const payload = message.payload as {
          sessionId: string;
          participantName: string;
          type: string;
          timestamp: number;
          metadata?: Record<string, unknown>;
        };
        void interactionRepo
          .addInteraction(payload)
          .then(() => sendResponse({ success: true }))
          .catch((err) => {
            sendResponse({
              success: false,
              error: err instanceof Error ? err.message : 'Failed to store interaction',
            });
          });
        return true;
      }

      case 'GET_RECORDING_FOR_WEB': {
        const payload = message.payload as { recordingKey?: string; latest?: boolean };
        void (async () => {
          try {
            const repo = new RecordingRepository();
            const recording = payload.latest
              ? await repo.getLatest()
              : payload.recordingKey
                ? await repo.getByKey(payload.recordingKey)
                : undefined;
            if (!recording) {
              sendResponse({ success: false, error: 'Recording not found' });
              return;
            }
            const chunks = await blobToBase64Chunks(recording.blob);
            sendResponse({
              success: true,
              recordingKey: recording.recordingKey,
              mimeType: recording.mimeType,
              meetingTitle: recording.meetingTitle,
              chunks,
              blobSize: recording.blob.size,
            });
          } catch (err) {
            sendResponse({
              success: false,
              error: err instanceof Error ? err.message : 'Failed to read recording',
            });
          }
        })();
        return true;
      }

      case 'DEBUG_LOG': {
        const logPayload = (message as { payload?: Record<string, unknown> }).payload;
        if (logPayload) {
          writeDebugLog(
            String(logPayload.location ?? 'background'),
            String(logPayload.message ?? ''),
            (logPayload.data as Record<string, unknown>) ?? {},
            String(logPayload.hypothesisId ?? ''),
            String(logPayload.runId ?? 'post-fix'),
          );
        }
        sendResponse({ success: true });
        return false;
      }

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
        return false;
    }
  },
);
