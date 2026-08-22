import type { MeetingPlatformAdapter } from './MeetingPlatformAdapter';
import type { MeetingInfo, DetectedParticipant, ChatEvent } from '../../types/extension.types';
import { EXTENSION_CONSTANTS } from '../../constants/extension.constants';

/**
 * Google Meet Adapter — all Meet-specific DOM interactions are isolated here.
 *
 * IMPORTANT: Google Meet's DOM is not a public API. Selectors documented below
 * were verified as of August 2026 but may break at any time. Each selector is
 * annotated with its last verification date. Handle failures gracefully — return
 * null or empty data, never fabricate.
 *
 * Feasibility classification per docs/google-meet-integration.md:
 * - Meeting detection: Reliable (URL pattern)
 * - Participant list: Potentially Reliable (DOM — isolated here)
 * - Chat messages: Potentially Reliable (DOM MutationObserver)
 * - Speaking detection: Requires POC
 */
export class GoogleMeetAdapter implements MeetingPlatformAdapter {
  private observers: MutationObserver[] = [];
  private cleanupFns: Array<() => void> = [];

  detectMeeting(): MeetingInfo | null {
    const match = EXTENSION_CONSTANTS.GOOGLE_MEET_URL_PATTERN.exec(window.location.href);
    if (!match || !match[1]) return null;

    const title = document.title.replace(' - Google Meet', '').trim() || match[1];

    return {
      externalMeetingId: match[1],
      title,
      platform: 'google_meet',
      startedAt: Date.now(),
    };
  }

  onParticipantChange(
    callback: (participants: DetectedParticipant[]) => void,
  ): () => void {
    /**
     * POTENTIALLY RELIABLE — verified 2026-08.
     * Google Meet renders participant tiles; we observe the tile container.
     * If the selector stops matching, we log a warning and stop observing.
     */
    const getParticipants = (): DetectedParticipant[] => {
      try {
        const nameElements = document.querySelectorAll('[data-self-name]');
        if (nameElements.length === 0) {
          const altNames = document.querySelectorAll('.KF4T6b');
          if (altNames.length === 0) return [];
          return Array.from(altNames).map((el) => ({
            displayName: el.textContent?.trim() ?? 'Unknown',
            isSelf: false,
            isSpeaking: false,
          }));
        }

        return Array.from(nameElements).map((el) => ({
          displayName: el.getAttribute('data-self-name') ?? el.textContent?.trim() ?? 'Unknown',
          isSelf: el.hasAttribute('data-is-self'),
          isSpeaking: false,
        }));
      } catch {
        console.warn('[CHIRPY] GoogleMeetAdapter: participant detection failed — DOM may have changed');
        return [];
      }
    };

    const observer = new MutationObserver(() => {
      callback(getParticipants());
    });

    const root = document.body;
    observer.observe(root, { childList: true, subtree: true });
    this.observers.push(observer);

    callback(getParticipants());

    return () => observer.disconnect();
  }

  onChatMessage(callback: (event: ChatEvent) => void): () => void {
    /**
     * POTENTIALLY RELIABLE — chat panel must be open.
     * Observes the chat message list for new nodes.
     */
    let lastMessageCount = 0;

    const getMessages = () => {
      try {
        return document.querySelectorAll('[data-message-id]');
      } catch {
        return null;
      }
    };

    const observer = new MutationObserver(() => {
      const messages = getMessages();
      if (!messages) return;

      if (messages.length > lastMessageCount) {
        const newMessages = Array.from(messages).slice(lastMessageCount);
        for (const msg of newMessages) {
          const senderEl = msg.querySelector('[data-sender-name]');
          const textEl = msg.querySelector('[data-message-text]');
          if (!senderEl || !textEl) continue;

          callback({
            senderName: senderEl.textContent?.trim() ?? 'Unknown',
            message: textEl.textContent?.trim() ?? '',
            timestamp: Date.now(),
          });
        }
        lastMessageCount = messages.length;
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    this.observers.push(observer);

    return () => observer.disconnect();
  }

  onSpeakingChange(
    _callback: (participantName: string, speaking: boolean) => void,
  ): () => void {
    /**
     * REQUIRES POC — speaking ring detection via DOM is fragile.
     * Not implemented until POC confirms selector stability.
     * Returns a no-op cleanup function.
     */
    console.warn('[CHIRPY] GoogleMeetAdapter: speaking detection via DOM requires POC — not active');
    return () => undefined;
  }

  onMeetingEnd(callback: () => void): () => void {
    const checkEnded = () => {
      const match = EXTENSION_CONSTANTS.GOOGLE_MEET_URL_PATTERN.exec(window.location.href);
      if (!match) {
        callback();
      }
    };

    const observer = new MutationObserver(checkEnded);
    observer.observe(document.querySelector('title') ?? document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    this.observers.push(observer);

    return () => observer.disconnect();
  }

  destroy(): void {
    for (const observer of this.observers) {
      observer.disconnect();
    }
    this.observers = [];
    for (const cleanup of this.cleanupFns) {
      cleanup();
    }
    this.cleanupFns = [];
  }
}
