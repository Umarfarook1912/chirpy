import { debugLog } from '../utils/debugLog';

function forwardToBackground(
  requestId: string,
  messageType: string,
  payload: Record<string, unknown>,
): void {
  void chrome.runtime
    .sendMessage({ type: messageType, payload })
    .then((response: {
      success?: boolean;
      error?: string;
      chunks?: string[];
      mimeType?: string;
      meetingTitle?: string;
      recordingKey?: string;
      blobSize?: number;
    }) => {
      if (!response?.success) {
        window.postMessage(
          { type: 'CHIRPY_RECORDING_RESPONSE', requestId, error: response?.error ?? 'Recording not found' },
          '*',
        );
        return;
      }

      debugLog(
        'webBridge.ts:forward',
        'recording served to web',
        {
          recordingKey: response.recordingKey ?? payload.recordingKey ?? 'latest',
          chunks: response.chunks?.length ?? 0,
          blobSize: response.blobSize ?? 0,
        },
        'H-bridge',
      );

      window.postMessage(
        {
          type: 'CHIRPY_RECORDING_RESPONSE',
          requestId,
          recordingKey: response.recordingKey,
          mimeType: response.mimeType,
          meetingTitle: response.meetingTitle,
          chunks: response.chunks,
          blobSize: response.blobSize,
        },
        '*',
      );
    })
    .catch(() => {
      window.postMessage(
        { type: 'CHIRPY_RECORDING_RESPONSE', requestId, error: 'Extension error' },
        '*',
      );
    });
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  const { type, requestId } = event.data as { type?: string; requestId?: string };

  if (type === 'CHIRPY_PING_BRIDGE') {
    window.postMessage({ type: 'CHIRPY_BRIDGE_READY' }, '*');
    return;
  }

  if (!requestId) return;

  if (type === 'CHIRPY_GET_RECORDING') {
    const { recordingKey } = event.data as { recordingKey: string };
    forwardToBackground(requestId, 'GET_RECORDING_FOR_WEB', { recordingKey });
    return;
  }

  if (type === 'CHIRPY_GET_LATEST_RECORDING') {
    forwardToBackground(requestId, 'GET_RECORDING_FOR_WEB', { latest: true });
  }
});

window.postMessage({ type: 'CHIRPY_BRIDGE_READY' }, '*');
