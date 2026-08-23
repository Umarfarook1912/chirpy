function base64ChunksToBlob(chunks: string[], mimeType: string): Blob {
  const parts: BlobPart[] = [];
  for (const chunk of chunks) {
    const binary = atob(chunk);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    parts.push(bytes);
  }
  return new Blob(parts, { type: mimeType || 'video/webm' });
}

export interface ExtensionRecording {
  blob: Blob;
  previewUrl: string;
  mimeType: string;
  meetingTitle: string;
  recordingKey?: string;
}

function waitForBridgeReady(timeoutMs = 5_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('CHIRPY extension bridge not ready')), timeoutMs);

    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.type !== 'CHIRPY_BRIDGE_READY') return;
      window.clearTimeout(timer);
      window.removeEventListener('message', handler);
      resolve();
    };

    window.addEventListener('message', handler);
    window.postMessage({ type: 'CHIRPY_PING_BRIDGE' }, '*');
  });
}

export function fetchRecordingFromExtension(recordingKey: string): Promise<ExtensionRecording> {
  return requestRecordingFromExtension('CHIRPY_GET_RECORDING', { recordingKey });
}

export function fetchLatestRecordingFromExtension(): Promise<ExtensionRecording> {
  return requestRecordingFromExtension('CHIRPY_GET_LATEST_RECORDING', {});
}

function requestRecordingFromExtension(
  type: string,
  data: Record<string, string>,
): Promise<ExtensionRecording> {
  return waitForBridgeReady()
    .catch(() => undefined)
    .then(() => new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const timeout = window.setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('CHIRPY extension did not respond within 20s. Reload the page or reinstall the extension.'));
      }, 20_000);

      const handler = (event: MessageEvent) => {
        if (event.source !== window) return;
        if (event.data?.type !== 'CHIRPY_RECORDING_RESPONSE') return;
        if (event.data.requestId !== requestId) return;

        window.clearTimeout(timeout);
        window.removeEventListener('message', handler);

        if (event.data.error) {
          reject(new Error(String(event.data.error)));
          return;
        }

        const chunks = event.data.chunks as string[] | undefined;
        const mimeType = (event.data.mimeType as string) || 'video/webm';

        if (!chunks || chunks.length === 0) {
          reject(new Error('Recording data was not received from extension'));
          return;
        }

        try {
          const blob = base64ChunksToBlob(chunks, mimeType);
          if (blob.size === 0) {
            reject(new Error('Recording blob is empty'));
            return;
          }
          resolve({
            blob,
            previewUrl: URL.createObjectURL(blob),
            mimeType,
            meetingTitle: (event.data.meetingTitle as string) || 'meeting',
            recordingKey: event.data.recordingKey as string | undefined,
          });
        } catch (err) {
          reject(new Error(err instanceof Error ? err.message : 'Failed to decode recording'));
        }
      };

      window.addEventListener('message', handler);
      window.postMessage({ type, requestId, ...data }, '*');
    }));
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function revokeRecordingPreview(recording: ExtensionRecording | null): void {
  if (recording?.previewUrl) {
    URL.revokeObjectURL(recording.previewUrl);
  }
}
