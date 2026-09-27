import { RecordingService } from '../recording/RecordingService';
import type { RecordingStopResult } from '../recording/RecordingService';
import { RecordingRepository } from '../db/RecordingRepository';
import type { RecordingStatus } from '@chirpy/shared';

const recordingRepo = new RecordingRepository();

let service: RecordingService | null = null;
let meetingTitle = 'meeting';
let sessionId = '';
let lastSavedRecordingKey: string | null = null;
let stopInFlight: Promise<RecordingStopResult | null> | null = null;

function notifyState(status: RecordingStatus, elapsedSeconds = 0, errorMessage?: string): void {
  void chrome.runtime.sendMessage({
    type: 'RECORDING_STATE_CHANGED',
    payload: { status, elapsedSeconds, errorMessage },
  });
}

function getService(): RecordingService {
  if (!service) {
    service = new RecordingService(
      (status, errorMessage) => {
        notifyState(status, 0, errorMessage);
      },
      (elapsedSeconds) => {
        notifyState('recording', elapsedSeconds);
      },
      meetingTitle,
    );
  }
  return service;
}

async function persistRecording(result: RecordingStopResult): Promise<string> {
  await recordingRepo.save({
    recordingKey: result.recordingKey,
    sessionId: sessionId || crypto.randomUUID(),
    meetingTitle,
    mimeType: result.mimeType,
    blob: result.blob,
    createdAt: Date.now(),
  });
  lastSavedRecordingKey = result.recordingKey;
  return result.recordingKey;
}

async function stopAndPersist(): Promise<RecordingStopResult | null> {
  if (stopInFlight) return stopInFlight;

  stopInFlight = getService()
    .stop()
    .then(async (result) => {
      service = null;
      if (!result) {
        return null;
      }
      await persistRecording(result);
      return result;
    })
    .finally(() => {
      stopInFlight = null;
    });

  return stopInFlight;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'OFFSCREEN_RECORDING_START') {
    const payload = message.payload as { meetingTitle?: string; sessionId?: string } | undefined;
    meetingTitle = payload?.meetingTitle ?? 'meeting';
    sessionId = payload?.sessionId ?? '';
    service = null;
    lastSavedRecordingKey = null;
    stopInFlight = null;

    const recorder = getService();
    recorder.setSessionContext(sessionId, meetingTitle);

    void recorder
      .start()
      .then(() => sendResponse({ success: true }))
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : 'Recording failed';
        sendResponse({ success: false, error: errorMessage });
      });
    return true;
  }

  if (message.type === 'OFFSCREEN_RECORDING_STOP') {
    void (async () => {
      if (lastSavedRecordingKey) {
        sendResponse({ success: true, recordingKey: lastSavedRecordingKey });
        return;
      }

      const result = await stopAndPersist();
      if (!result) {
        const latest = sessionId ? await recordingRepo.getLatest() : undefined;
        if (latest?.sessionId === sessionId) {
          lastSavedRecordingKey = latest.recordingKey;
          sendResponse({ success: true, recordingKey: latest.recordingKey });
          return;
        }
        sendResponse({ success: false });
        return;
      }

      sendResponse({
        success: true,
        recordingKey: result.recordingKey,
        mimeType: result.mimeType,
      });
    })();
    return true;
  }

  return false;
});
