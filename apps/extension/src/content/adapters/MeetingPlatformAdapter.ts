import type { MeetingInfo, DetectedParticipant, ChatEvent } from '../../types/extension.types';

export interface MeetingPlatformAdapter {
  detectMeeting(): MeetingInfo | null;

  onParticipantChange(
    callback: (participants: DetectedParticipant[]) => void,
  ): () => void;

  onChatMessage(
    callback: (event: ChatEvent) => void,
  ): () => void;

  onSpeakingChange(
    callback: (participantName: string, speaking: boolean) => void,
  ): () => void;

  onMeetingEnd(callback: () => void): () => void;

  destroy(): void;
}
