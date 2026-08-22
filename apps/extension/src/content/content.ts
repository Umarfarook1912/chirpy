import { GoogleMeetAdapter } from './adapters/GoogleMeetAdapter';
import { InteractionRepository } from '../db/InteractionRepository';
import { EXTENSION_CONSTANTS } from '../constants/extension.constants';

const adapter = new GoogleMeetAdapter();
const interactionRepo = new InteractionRepository();

let currentSessionId: string | null = null;
let cleanupFns: Array<() => void> = [];

function startTracking(sessionId: string): void {
  currentSessionId = sessionId;

  cleanupFns.push(
    adapter.onChatMessage((event) => {
      void interactionRepo.addInteraction({
        sessionId,
        participantName: event.senderName,
        type: 'chat_message',
        timestamp: event.timestamp,
      });
    }),
  );

  cleanupFns.push(
    adapter.onMeetingEnd(() => {
      stopTracking();
      void chrome.runtime.sendMessage({
        type: 'MEETING_ENDED',
        payload: { sessionId },
      });
    }),
  );
}

function stopTracking(): void {
  for (const cleanup of cleanupFns) {
    cleanup();
  }
  cleanupFns = [];
  currentSessionId = null;
  adapter.destroy();
}

function initialize(): void {
  const meeting = adapter.detectMeeting();
  if (!meeting) return;

  const sessionId = `${meeting.externalMeetingId}-${meeting.startedAt}`;

  void chrome.runtime.sendMessage({
    type: 'MEETING_STARTED',
    payload: { sessionId, meeting },
  });

  startTracking(sessionId);
}

if (window.location.hostname === EXTENSION_CONSTANTS.GOOGLE_MEET_HOST) {
  initialize();
}
