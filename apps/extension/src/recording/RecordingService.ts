import { RECORDING_CONFIG, RECORDING_ERRORS } from '@chirpy/shared';
import { RecordingStateMachine } from './RecordingState';
import { captureDisplayMedia, getSupportedMimeType, stopStream } from './StreamCapture';
import type { RecordingStatus } from '@chirpy/shared';

export type RecordingStateChangeCallback = (status: RecordingStatus, errorMessage?: string) => void;

export interface RecordingStopResult {
  recordingKey: string;
  mimeType: string;
  blob: Blob;
}

export class RecordingService {
  private stateMachine = new RecordingStateMachine();
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private elapsedTimer: ReturnType<typeof setInterval> | null = null;
  private elapsedSeconds = 0;
  private onStateChange: RecordingStateChangeCallback;
  private onElapsedUpdate: (seconds: number) => void;
  private meetingTitle: string;
  private sessionId = '';
  private mimeType = 'video/webm';

  constructor(
    onStateChange: RecordingStateChangeCallback,
    onElapsedUpdate: (seconds: number) => void,
    meetingTitle = 'meeting',
  ) {
    this.onStateChange = onStateChange;
    this.onElapsedUpdate = onElapsedUpdate;
    this.meetingTitle = meetingTitle;
  }

  setSessionContext(sessionId: string, meetingTitle?: string): void {
    this.sessionId = sessionId;
    if (meetingTitle) this.meetingTitle = meetingTitle;
  }

  get status(): RecordingStatus {
    return this.stateMachine.status;
  }

  async start(): Promise<void> {
    if (!this.stateMachine.transition('requesting')) return;
    this.onStateChange('requesting');

    try {
      this.mimeType = getSupportedMimeType();
      if (!this.mimeType) {
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
        mimeType: this.mimeType,
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

  async stop(): Promise<RecordingStopResult | null> {
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
        const blob = new Blob(this.chunks, { type: this.mimeType });
        const recordingKey = crypto.randomUUID();

        this.cleanup();
        this.stateMachine.transition('completed');
        this.onStateChange('completed');

        resolve({
          recordingKey,
          mimeType: this.mimeType,
          blob,
        });
      };

      this.mediaRecorder.stop();
    });
  }

  reset(): void {
    this.cleanup();
    this.stateMachine.reset();
    this.onStateChange('idle');
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getMeetingTitle(): string {
    return this.meetingTitle;
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
    this.elapsedSeconds = 0;
  }
}
