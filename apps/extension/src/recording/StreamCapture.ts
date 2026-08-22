import { RECORDING_ERRORS } from '@chirpy/shared';

export interface CaptureResult {
  stream: MediaStream;
  type: 'display' | 'microphone';
}

export async function captureDisplayMedia(): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: 30 },
        displaySurface: 'browser',
      },
      audio: true,
    });
    return stream;
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError') {
        throw new Error(RECORDING_ERRORS.PERMISSION_DENIED);
      }
      if (err.name === 'NotSupportedError') {
        throw new Error(RECORDING_ERRORS.NOT_SUPPORTED);
      }
    }
    throw new Error(RECORDING_ERRORS.UNKNOWN);
  }
}

export function getSupportedMimeType(): string {
  const preferred = 'video/webm;codecs=vp9,opus';
  const fallback = 'video/webm';

  if (MediaRecorder.isTypeSupported(preferred)) return preferred;
  if (MediaRecorder.isTypeSupported(fallback)) return fallback;

  return '';
}

export function stopStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}
