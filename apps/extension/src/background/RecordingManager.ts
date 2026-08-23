import type { RecordingStatus } from '@chirpy/shared';
import { EXTENSION_CONSTANTS } from '../constants/extension.constants';
import type { ActiveRecordingState } from '../types/extension.types';
import { writeDebugLog } from '../utils/debugLog';

const STORAGE_KEY = 'chirpy:activeRecording';

let cachedState: ActiveRecordingState | null = null;

async function readState(): Promise<ActiveRecordingState | null> {
  if (cachedState) return cachedState;
  const result = await chrome.storage.session.get(STORAGE_KEY);
  cachedState = (result[STORAGE_KEY] as ActiveRecordingState | undefined) ?? null;
  return cachedState;
}

async function writeState(state: ActiveRecordingState | null): Promise<void> {
  cachedState = state;
  if (state) {
    await chrome.storage.session.set({ [STORAGE_KEY]: state });
  } else {
    await chrome.storage.session.remove(STORAGE_KEY);
  }
}

async function ensureOffscreenDocument(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });

  if (contexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: 'src/offscreen/offscreen.html',
    reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.DISPLAY_MEDIA],
    justification: 'Record meeting audio and video while the popup is closed',
  });
}

async function closeOffscreenDocument(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });

  if (contexts.length === 0) return;
  await chrome.offscreen.closeDocument();
}

async function broadcastToTab(tabId: number, message: unknown): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    /* content script may not be ready */
  }
}

export async function getActiveRecording(): Promise<ActiveRecordingState | null> {
  return readState();
}

export async function startRecording(
  tabId: number,
  meetingTitle?: string,
  sessionId?: string,
): Promise<void> {
  const existing = await readState();
  if (existing?.status === 'recording' || existing?.status === 'requesting') {
    throw new Error('A recording is already in progress');
  }

  await writeState({
    tabId,
    status: 'requesting',
    elapsedSeconds: 0,
  });

  await broadcastToTab(tabId, {
    type: 'RECORDING_UI_UPDATE',
    payload: { status: 'requesting', elapsedSeconds: 0 },
  });

  await ensureOffscreenDocument();

  const response = await chrome.runtime.sendMessage({
    type: 'OFFSCREEN_RECORDING_START',
    payload: { meetingTitle, sessionId },
  });

  if (!response?.success) {
    await writeState(null);
    await broadcastToTab(tabId, {
      type: 'RECORDING_UI_UPDATE',
      payload: {
        status: 'error',
        elapsedSeconds: 0,
        errorMessage: response?.error ?? 'Failed to start recording',
      },
    });
    throw new Error(response?.error ?? 'Failed to start recording');
  }
}

export async function stopRecording(options: {
  syncSession: boolean;
  suppressUi?: boolean;
}): Promise<{ recordingKey?: string } | void> {
  const state = await readState();
  writeDebugLog(
    'RecordingManager.ts:stopRecording',
    'stop entry',
    { hasState: Boolean(state), status: state?.status ?? null, elapsed: state?.elapsedSeconds ?? null },
    'H-recording',
  );
  if (!state) return;

  const tabId = state.tabId;
  const elapsedSeconds = state.elapsedSeconds;

  if (options.syncSession) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'TRIGGER_FINISH_UI',
        payload: { reason: 'recording-stopped' },
      });
    } catch {
      /* content script may not be ready */
    }
  }

  if (!options.suppressUi) {
    await broadcastToTab(tabId, {
      type: 'RECORDING_UI_UPDATE',
      payload: { status: 'stopping', elapsedSeconds },
    });
  }

  let recordingKey: string | undefined;

  try {
    await ensureOffscreenDocument();

    const offscreenResponse = (await Promise.race([
      chrome.runtime.sendMessage({ type: 'OFFSCREEN_RECORDING_STOP' }),
        new Promise<{ success: false }>((resolve) => {
          setTimeout(() => resolve({ success: false }), 20_000);
        }),
    ])) as { success?: boolean; recordingKey?: string };

    recordingKey = offscreenResponse?.recordingKey;
    writeDebugLog(
      'RecordingManager.ts:stopRecording',
      'offscreen stop response',
      {
        success: offscreenResponse?.success ?? false,
        recordingKey: recordingKey ?? null,
      },
      'H-recording',
    );
  } catch (err) {
    writeDebugLog(
      'RecordingManager.ts:stopRecording',
      'offscreen stop error',
      { error: err instanceof Error ? err.message : 'unknown' },
      'H-recording',
    );
  } finally {
    await closeOffscreenDocument();
    await writeState(null);

    if (!options.suppressUi) {
      await broadcastToTab(tabId, {
        type: 'RECORDING_UI_UPDATE',
        payload: { status: 'completed', elapsedSeconds },
      });
    }
  }

  return { recordingKey };
}

export async function handleRecordingStateChanged(payload: {
  status: RecordingStatus;
  elapsedSeconds: number;
  errorMessage?: string;
}): Promise<void> {
  const state = await readState();
  if (!state) return;

  const next: ActiveRecordingState = {
    tabId: state.tabId,
    status: payload.status,
    elapsedSeconds: payload.elapsedSeconds,
    errorMessage: payload.errorMessage,
  };

  if (payload.status === 'completed' || payload.status === 'error' || payload.status === 'idle') {
    await writeState(null);
    if (payload.status !== 'completed') {
      await closeOffscreenDocument();
    }
  } else {
    await writeState(next);
  }

  await broadcastToTab(state.tabId, {
    type: 'RECORDING_UI_UPDATE',
    payload: {
      status: payload.status,
      elapsedSeconds: payload.elapsedSeconds,
      errorMessage: payload.errorMessage,
    },
  });
}

export async function prepareRecordingTab(tabId: number): Promise<{ meetingTitle: string; sessionId?: string }> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url?.includes(EXTENSION_CONSTANTS.GOOGLE_MEET_HOST)) {
    throw new Error('Open a Google Meet call before recording');
  }

  const sendPrepare = async () =>
    chrome.tabs.sendMessage(tabId, { type: 'PREPARE_RECORDING' }) as Promise<{
      success?: boolean;
      meetingTitle?: string;
      sessionId?: string;
    }>;

  try {
    const response = await sendPrepare();
    return {
      meetingTitle: response?.meetingTitle ?? 'meeting',
      sessionId: response?.sessionId,
    };
  } catch {
    const manifest = chrome.runtime.getManifest();
    const scriptFiles = manifest.content_scripts?.flatMap((cs) => cs.js ?? []) ?? [];
    for (const file of scriptFiles) {
      await chrome.scripting.executeScript({ target: { tabId }, files: [file] });
    }
    const response = await sendPrepare();
    return {
      meetingTitle: response?.meetingTitle ?? 'meeting',
      sessionId: response?.sessionId,
    };
  }
}
