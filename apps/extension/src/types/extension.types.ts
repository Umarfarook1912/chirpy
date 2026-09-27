import type { MeetingPlatform, RecordingStatus } from '@chirpy/shared';

export interface ActiveRecordingState {
  tabId: number;
  status: RecordingStatus;
  elapsedSeconds: number;
  errorMessage?: string;
}

export interface MeetingInfo {
  externalMeetingId: string;
  title: string;
  platform: MeetingPlatform;
  startedAt: number;
}

export interface DetectedParticipant {
  displayName: string;
  isSelf: boolean;
  isSpeaking: boolean;
}

export interface ChatEvent {
  senderName: string;
  message: string;
  timestamp: number;
}

export interface SpeakingEvent {
  participantName: string;
  speaking: boolean;
  timestamp: number;
}

export interface ExtensionMessage {
  type: ExtensionMessageType;
  payload?: unknown;
}

export type ExtensionMessageType =
  | 'MEETING_STARTED'
  | 'MEETING_ENDED'
  | 'PARTICIPANT_JOINED'
  | 'PARTICIPANT_LEFT'
  | 'CHAT_MESSAGE'
  | 'HAND_RAISED'
  | 'REACTION'
  | 'SPEAKING_STARTED'
  | 'SPEAKING_STOPPED'
  | 'SYNC_SESSION'
  | 'RECORDING_START'
  | 'RECORDING_STOP'
  | 'RECORDING_GET_STATE'
  | 'RECORDING_STATE_CHANGED'
  | 'PREPARE_RECORDING'
  | 'RECORDING_UI_UPDATE'
  | 'END_MEETING_SESSION'
  | 'OPEN_MEETING_TAB'
  | 'FINISH_MEETING_SESSION'
  | 'DOWNLOAD_RECORDING'
  | 'GET_RECORDING_FOR_WEB'
  | 'STORE_INTERACTION'
  | 'OFFSCREEN_RECORDING_START'
  | 'OFFSCREEN_RECORDING_STOP';
