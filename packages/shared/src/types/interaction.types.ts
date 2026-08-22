export type InteractionType =
  | 'chat_message'
  | 'hand_raise'
  | 'reaction'
  | 'speaking_start'
  | 'speaking_stop'
  | 'join'
  | 'leave';

export interface Interaction {
  id: string;
  sessionId: string;
  meetingId: string;
  participantId: string;
  type: InteractionType;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface InteractionCount {
  type: InteractionType;
  count: number;
}

export interface LocalInteractionEvent {
  type: InteractionType;
  timestamp: number;
  participantDisplayName: string;
  metadata?: Record<string, unknown>;
}
