import { RECORDING_CONFIG, RECORDING_ERRORS, getRecordingFileName } from '@chirpy/shared';
import { RecordingStateMachine } from './RecordingState';
import { captureDisplayMedia, getSupportedMimeType, stopStream } from './StreamCapture';
import type { RecordingStatus } from '@chirpy/shared';

export type RecordingStateChangeCallback = (status: RecordingStatus, errorMessage?: string) => void;

export class RecordingService {
  private stateMachine = new RecordingStateMachine();
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startTime: number | null = null;
  private elapsedTimer: ReturnType<typeof setInterval> | null = null;
  private elapsedSeconds = 0;
  private onStateChange: RecordingStateChangeCallback;
  private onElapsedUpdate: (seconds: number) => void;
  private meetingTitle: string;

  constructor(
    onStateChange: RecordingStateChangeCallback,
    onElapsedUpdate: (seconds: number) => void,
    meetingTitle = 'meeting',
  ) {
    this.onStateChange = onStateChange;
    this.onElapsedUpdate = onElapsedUpdate;
    this.meetingTitle = meetingTitle;
  }

  get status(): RecordingStatus {
    return this.stateMachine.status;
  }

  async start(): Promise<void> {
    if (!this.stateMachine.transition('requesting')) return;
    this.onStateChange('requesting');

    try {
      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        throw new Error(RECORDING_ERRORS.NOT_SUPPORTED);
      }

      this.stream = await captureDisplayMedia();
      this.chunks = [];

      this.stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          void this.stop();
        });
      });

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        videoBitsPerSecond: RECORDING_CONFIG.VIDEO_BITS_PER_SECOND,
        audioBitsPerSecond: RECORDING_CONFIG.AUDIO_BITS_PER_SECOND,
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = () => {
        this.handleError(RECORDING_ERRORS.ENCODER_ERROR);
      };

      this.mediaRecorder.start(RECORDING_CONFIG.TIMESLICE_MS);
      this.startTime = Date.now();
      this.elapsedSeconds = 0;

      this.elapsedTimer = setInterval(() => {
        this.elapsedSeconds++;
        this.onElapsedUpdate(this.elapsedSeconds);
      }, 1_000);

      this.stateMachine.transition('recording');
      this.onStateChange('recording');
    } catch (err) {
      this.cleanup();
      const message = err instanceof Error ? err.message : RECORDING_ERRORS.UNKNOWN;
      this.stateMachine.transition('error');
      this.onStateChange('error', message);
    }
  }

  async stop(): Promise<string | null> {
    if (!this.stateMachine.transition('stopping')) return null;
    this.onStateChange('stopping');

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        this.cleanup();
        this.stateMachine.transition('error');
        this.onStateChange('error', RECORDING_ERRORS.STREAM_ENDED);
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const fileName = getRecordingFileName(this.meetingTitle);

        this.cleanup();
        this.stateMachine.transition('completed');
        this.onStateChange('completed');

        resolve(url);
        void this.triggerDownload(url, fileName);
      };

      this.mediaRecorder.stop();
    });
  }

  reset(): void {
    this.cleanup();
    this.stateMachine.reset();
    this.onStateChange('idle');
  }

  private triggerDownload(url: string, fileName: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  private handleError(message: string): void {
    this.cleanup();
    this.stateMachine.transition('error');
    this.onStateChange('error', message);
  }

  private cleanup(): void {
    if (this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
    if (this.stream) {
      stopStream(this.stream);
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
    this.startTime = null;
    this.elapsedSeconds = 0;
  }
}
