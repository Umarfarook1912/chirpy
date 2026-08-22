export interface Participant {
  id: string;
  meetingId: string;
  userId?: string;
  displayName: string;
  joinedAt: string;
  leftAt?: string;
  durationSeconds: number;
  participationScore: number;
  isHost: boolean;
}

export interface ParticipantMetrics {
  participantId: string;
  displayName: string;
  attendanceDurationSeconds: number;
  chatMessageCount: number;
  handRaiseCount: number;
  reactionCount: number;
  speakingDurationSeconds: number;
  participationScore: number;
}
