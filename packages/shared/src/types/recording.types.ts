export type RecordingStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'stopping'
  | 'completed'
  | 'error';

export interface RecordingState {
  status: RecordingStatus;
  elapsedSeconds: number;
  errorMessage?: string;
  blobUrl?: string;
  fileName?: string;
}

export interface RecordingConfig {
  mimeType: string;
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
  timesliceMs: number;
}
