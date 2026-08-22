import type { MeetingPlatform } from '@chirpy/shared';

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
  | 'RECORDING_STOP';
