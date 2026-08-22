import type { RecordingStatus } from '../types/recording.types';

export const RECORDING_STATUS = {
  IDLE: 'idle' as RecordingStatus,
  REQUESTING: 'requesting' as RecordingStatus,
  RECORDING: 'recording' as RecordingStatus,
  STOPPING: 'stopping' as RecordingStatus,
  COMPLETED: 'completed' as RecordingStatus,
  ERROR: 'error' as RecordingStatus,
} as const;

export const RECORDING_CONFIG = {
  PREFERRED_MIME_TYPE: 'video/webm;codecs=vp9,opus',
  FALLBACK_MIME_TYPE: 'video/webm',
  VIDEO_BITS_PER_SECOND: 2_500_000,
  AUDIO_BITS_PER_SECOND: 128_000,
  TIMESLICE_MS: 1_000,
} as const;

export const RECORDING_ERRORS = {
  PERMISSION_DENIED: 'Recording permission was denied. Please allow screen capture to record.',
  NOT_SUPPORTED: 'Your browser does not support screen recording. Please use Chrome 88+.',
  STREAM_ENDED: 'The recording stream ended unexpectedly.',
  ENCODER_ERROR: 'An encoding error occurred during recording.',
  UNKNOWN: 'An unknown recording error occurred.',
} as const;

export function getRecordingFileName(meetingTitle: string): string {
  const sanitized = meetingTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `chirpy-recording-${sanitized}-${timestamp}.webm`;
}
