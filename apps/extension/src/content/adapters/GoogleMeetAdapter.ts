import type { MeetingPlatformAdapter } from './MeetingPlatformAdapter';
import type { MeetingInfo, DetectedParticipant, ChatEvent, SpeakingEvent } from '../../types/extension.types';
import { EXTENSION_CONSTANTS } from '../../constants/extension.constants';
import { isValidParticipantName } from '../../utils/blob.utils';
import { debugLog } from '../../utils/debugLog';

// ─── Chat helpers ────────────────────────────────────────────────────────────

function findChatRoot(): Element | null {
  const messageInput = document.querySelector(
    '[aria-label*="Send a message" i], [placeholder*="Send a message" i], textarea[aria-label*="message" i]',
  );
  if (messageInput) {
    const panel = messageInput.closest('[role="complementary"], [role="dialog"], [data-panel-id]');
    if (panel) return panel;
  }
  const messageLog = document.querySelector('[role="log"]');
  if (messageLog) return messageLog;
  const ss4Block = document.querySelector('div.Ss4fHf');
  if (ss4Block) {
    return ss4Block.closest('[role="complementary"], [role="dialog"], [data-panel-id]') ?? ss4Block.parentElement;
  }
  return (
    document.querySelector('[data-panel-id="chat"]') ??
    document.querySelector('[aria-label="In-call messages"]') ??
    document.querySelector('[aria-label*="In-call messages"]') ??
    document.querySelector('[aria-label*="Chat with everyone"]')?.closest('[role="complementary"]') ??
    document.querySelector('[aria-label*="Chat"][role="complementary"]') ??
    document.querySelector('[aria-label*="chat"][role="complementary"]')
  );
}

function parseSs4fBlock(block: Element): ChatEvent | null {
  const sender =
    block.querySelector('.poVWob')?.textContent?.trim() ??
    block.querySelector('[data-sender-name]')?.textContent?.trim();
  const messageParts = Array.from(block.querySelectorAll('[jsname="dTKtvb"], [data-message-text]'))
    .map((el) => el.textContent?.trim())
    .filter(Boolean) as string[];
  if (!sender || messageParts.length === 0) return null;
  const message = messageParts.join(' ').trim();
  if (!isValidChat(sender, message)) return null;
  return { senderName: sender, message, timestamp: Date.now() };
}

function parseListItemChat(node: Element): ChatEvent | null {
  const lines = extractMessageLines(node);
  if (lines.length >= 2) {
    const senderName = lines[0]!;
    const message = lines.slice(1).join(' ').trim();
    if (isValidChat(senderName, message)) {
      return { senderName, message, timestamp: Date.now() };
    }
  }
  return null;
}

function extractMessageLines(root: Element): string[] {
  const lines: string[] = [];
  for (const el of root.querySelectorAll('div, span')) {
    if (el.children.length > 0) continue;
    const text = el.textContent?.trim();
    if (!text || /^\d{1,2}:\d{2}(\s?[AP]M)?$/i.test(text)) continue;
    if (lines.at(-1) !== text) lines.push(text);
  }
  return lines;
}

function parseChatNode(node: Element): ChatEvent | null {
  if (node.classList.contains('Ss4fHf') || node.closest('div.Ss4fHf')) {
    const block = node.classList.contains('Ss4fHf') ? node : node.closest('div.Ss4fHf')!;
    return parseSs4fBlock(block);
  }
  const messageRoot =
    node.hasAttribute('data-message-id') ? node : node.closest('[data-message-id]');
  if (messageRoot) {
    const senderEl = messageRoot.querySelector('[data-sender-name]');
    const textEl = messageRoot.querySelector('[data-message-text]');
    if (senderEl && textEl) {
      const senderName = senderEl.textContent?.trim();
      const message = textEl.textContent?.trim();
      if (senderName && message && isValidChat(senderName, message)) {
        return { senderName, message, timestamp: Date.now() };
      }
    }
    const lines = extractMessageLines(messageRoot);
    if (lines.length >= 2) {
      const senderName = lines[0]!;
      const message = lines.slice(1).join(' ').trim();
      if (isValidChat(senderName, message)) {
        return { senderName, message, timestamp: Date.now() };
      }
    }
  }
  if (node.getAttribute('role') === 'listitem' || node.closest('[role="listitem"]')) {
    return parseListItemChat(node.closest('[role="listitem"]') ?? node);
  }
  return null;
}

function isValidChat(senderName: string, message: string): boolean {
  if (senderName === message) return false;
  if (senderName.includes('keepPin') || message.includes('keepPin')) return false;
  if (senderName.length > 80 || message.length > 2000) return false;
  if (/^Meet\b/i.test(senderName)) return false;
  if (/continuous chat|turned off|send messages|chat with everyone/i.test(message)) return false;
  if (/^(mic|videocam|more_vert|keyboard_arrow|call_end|front_hand|blur_on|info|apps|lock_person|alarm|back_hand|volume_up|devices|frame_person|visual_effects)/i.test(senderName)) return false;
  if (/Turn off|Leave call|Press the down arrow|Join now|Ready to join|Share screen|Meeting tools|Host controls|Raising your hand/i.test(senderName)) return false;
  return true;
}

function findChatInput(): HTMLElement | null {
  return document.querySelector(
    [
      '[aria-label*="Send a message" i]',
      '[placeholder*="Send a message" i]',
      'textarea[aria-label*="message" i]',
      'div[contenteditable="true"][aria-label*="message" i]',
      'div[contenteditable="true"][data-placeholder*="message" i]',
    ].join(', '),
  );
}

function getSelfDisplayName(): string {
  const self = document.querySelector('[data-self-name][data-is-self], [data-self-name]');
  return self?.getAttribute('data-self-name')?.trim() ?? 'You';
}

function readInputText(input: HTMLElement): string {
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
    return input.value.trim();
  }
  return input.innerText?.trim() ?? '';
}

// ─── Participant name extraction from tile ───────────────────────────────────

/**
 * Given a participant tile element (or any element inside it), extract the display name.
 * Google Meet uses several patterns across versions.
 */
function getNameFromTile(tile: Element): string | null {
  // data-self-name attribute
  const selfName = tile.getAttribute('data-self-name');
  if (selfName?.trim()) return selfName.trim();

  // aria-label="Name (you)" or "Name (host)"
  const ariaLabel = tile.getAttribute('aria-label');
  if (ariaLabel) {
    const stripped = ariaLabel.replace(/\s*\(you\)\s*$/i, '').replace(/\s*\(host\)\s*$/i, '').trim();
    if (stripped && stripped.length <= 80) return stripped;
  }

  // Name label inside the tile – various class names used across Meet versions
  const nameEl = tile.querySelector(
    '[data-self-name], .KF4T6b, .ZjFb7c, [class*="participantName"], [class*="name-label"]',
  );
  const name = nameEl?.textContent?.trim();
  if (name && name.length <= 80) return name;

  return null;
}

// ─── Speaking detection ──────────────────────────────────────────────────────

/**
 * Google Meet marks the speaking participant in multiple ways depending on version:
 *  1. aria-label="Name is speaking" on a participant tile
 *  2. CSS class "YEI2ub" (active audio waveform) inside a tile
 *  3. data-is-muted="false" toggles when speaking starts/stops (less reliable)
 *
 * We use all three and coalesce into a single speaking state map.
 */
function detectSpeakerFromTile(tile: Element): string | null {
  const label = tile.getAttribute('aria-label') ?? '';
  const speakingMatch = /^(.+?)\s+is speaking/i.exec(label);
  if (speakingMatch?.[1]) return speakingMatch[1].trim();

  if (tile.getAttribute('data-is-speaking') === 'true') {
    return getNameFromTile(tile);
  }

  const hasSpeakingIndicator =
    tile.querySelector(
      '.YEI2ub, .KV1GEc, .kssMZb, [class*="speaking-indicator"], [class*="speakingIndicator"], [class*="audioLevel"], [class*="speaking"]',
    ) !== null;
  if (hasSpeakingIndicator) {
    return getNameFromTile(tile);
  }

  return null;
}

function collectParticipantNames(): DetectedParticipant[] {
  const seen = new Set<string>();
  const results: DetectedParticipant[] = [];

  const addName = (name: string | null, isSelf: boolean, tile?: Element) => {
    if (!name || !isValidParticipantName(name) || seen.has(name)) return;
    seen.add(name);
    results.push({
      displayName: name,
      isSelf,
      isSpeaking: tile ? detectSpeakerFromTile(tile) !== null : false,
    });
  };

  for (const tile of document.querySelectorAll('[data-participant-id], [data-self-name]')) {
    addName(getNameFromTile(tile), tile.hasAttribute('data-is-self'), tile);
  }

  for (const item of document.querySelectorAll(
    '[aria-label*="People" i] [role="listitem"], [data-panel-id="people"] [role="listitem"], [aria-label*="Participants" i] [role="listitem"]',
  )) {
    const label = item.getAttribute('aria-label');
    if (!label) continue;
    const name = label
      .replace(/\s*\(you\)\s*$/i, '')
      .replace(/\s*\(host\)\s*$/i, '')
      .split(',')[0]
      ?.trim();
    addName(name || null, /\(you\)/i.test(label), item);
  }

  return results;
}

// ─── Main adapter ────────────────────────────────────────────────────────────

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

  /**
   * Emits participants present at each change.
   * Callers should diff against a previous set to detect joins/leaves.
   */
  onParticipantChange(
    callback: (participants: DetectedParticipant[]) => void,
  ): () => void {
    const getParticipants = (): DetectedParticipant[] => {
      try {
        return collectParticipantNames();
      } catch {
        return [];
      }
    };

    const observer = new MutationObserver(() => callback(getParticipants()));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', 'data-self-name'] });
    this.observers.push(observer);
    callback(getParticipants());

    const pollId = window.setInterval(() => callback(getParticipants()), 3_000);
    this.cleanupFns.push(() => window.clearInterval(pollId));
    return () => observer.disconnect();
  }

  /**
   * Emits (participantName, speaking:boolean) whenever Meet's DOM indicates a
   * speaking state change on any participant tile.
   *
   * Three complementary strategies run simultaneously:
   *  A) aria-label mutation – fastest when Meet uses "is speaking" labels
   *  B) class/childList mutations – catches YEI2ub waveform additions/removals
   *  C) 1-second poll – safety net for any missed mutations
   */
  onSpeakingChange(callback: (participantName: string, speaking: boolean) => void): () => void {
    const currentSpeakers = new Set<string>();

    const evalTile = (tile: Element) => {
      const speaker = detectSpeakerFromTile(tile);
      const name = getNameFromTile(tile);
      if (!name) return;

      if (speaker) {
        if (!currentSpeakers.has(name)) {
          currentSpeakers.add(name);
          debugLog('GoogleMeetAdapter:speaking', 'speaking start', { name }, 'H-speaking');
          callback(name, true);
        }
      } else {
        if (currentSpeakers.has(name)) {
          currentSpeakers.delete(name);
          debugLog('GoogleMeetAdapter:speaking', 'speaking stop', { name }, 'H-speaking');
          callback(name, false);
        }
      }
    };

    const scanAllTiles = () => {
      for (const tile of document.querySelectorAll('[data-participant-id], [data-self-name]')) {
        evalTile(tile);
      }
      // Clear stale speakers that are no longer in the DOM
      for (const name of Array.from(currentSpeakers)) {
        const stillPresent = Array.from(
          document.querySelectorAll('[data-participant-id], [data-self-name]'),
        ).some((t) => getNameFromTile(t) === name);
        if (!stillPresent) {
          currentSpeakers.delete(name);
          callback(name, false);
        }
      }
    };

    // Strategy A+B: observe aria-label + class mutations
    const speakObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const target = m.target as Element;
        const tile =
          target.closest('[data-participant-id], [data-self-name]') ??
          (target.matches('[data-participant-id], [data-self-name]') ? target : null);
        if (tile) evalTile(tile);
        // Also scan added nodes (waveform element inserted)
        for (const node of m.addedNodes) {
          if (node instanceof Element) {
            const t =
              node.closest('[data-participant-id], [data-self-name]') ??
              node.querySelector('[data-participant-id], [data-self-name]');
            if (t) evalTile(t);
          }
        }
        for (const node of m.removedNodes) {
          if (node instanceof Element) {
            // Waveform element removed → speaking ended
            if (
              node.classList.contains('YEI2ub') ||
              node.matches('[class*="speaking-indicator"]')
            ) {
              scanAllTiles();
            }
          }
        }
      }
    });

    speakObserver.observe(document.body, {
      subtree: true,
      attributeFilter: ['aria-label', 'class', 'data-is-muted'],
      attributes: true,
      childList: true,
    });

    // Strategy C: safety-net poll
    const pollId = window.setInterval(scanAllTiles, 1_000);

    this.observers.push(speakObserver);
    this.cleanupFns.push(() => window.clearInterval(pollId));

    return () => {
      speakObserver.disconnect();
      window.clearInterval(pollId);
    };
  }

  /**
   * Tracks when the local user's microphone is unmuted as speaking time.
   * Meet does not expose other participants' audio levels reliably via DOM.
   */
  onMicActivity(callback: (participantName: string, speaking: boolean) => void): () => void {
    let speaking = false;

    const checkMic = () => {
      const name = getSelfDisplayName();
      const micOffBtn = document.querySelector(
        'button[aria-label*="Turn off microphone" i], button[aria-label*="Mute microphone" i][data-is-muted="false"]',
      );
      const selfTile = document.querySelector('[data-is-self], [data-self-name][data-is-self]');
      const selfUnmuted = selfTile?.getAttribute('data-is-muted') === 'false';
      const active = Boolean(micOffBtn) || selfUnmuted;

      if (active && !speaking) {
        speaking = true;
        debugLog('GoogleMeetAdapter:micActivity', 'mic unmuted — speaking start', { name }, 'H-speaking');
        callback(name, true);
      } else if (!active && speaking) {
        speaking = false;
        debugLog('GoogleMeetAdapter:micActivity', 'mic muted — speaking stop', { name }, 'H-speaking');
        callback(name, false);
      }
    };

    const pollId = window.setInterval(checkMic, 500);
    checkMic();
    this.cleanupFns.push(() => window.clearInterval(pollId));
    return () => window.clearInterval(pollId);
  }

  /**
   * Detects hand-raise events. Google Meet shows a "front_hand" / raised-hand
   * icon on the participant tile or in the participants panel.
   *
   * We look for:
   *  – Elements whose text content contains the "front_hand" Material icon ligature
   *  – aria-label containing "raised hand" or "has raised"
   *  – A dedicated hand-raise badge element on participant tiles
   */
  onHandRaise(callback: (participantName: string, timestamp: number) => void): () => void {
    const processedRaises = new Set<string>();

    const emitRaise = (name: string) => {
      const bucket = `${name}-${Math.floor(Date.now() / 5_000)}`;
      if (processedRaises.has(bucket)) return;
      processedRaises.add(bucket);
      debugLog('GoogleMeetAdapter:handRaise', 'hand raise', { name }, 'H-interaction');
      callback(name, Date.now());
    };

    const onRaiseClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest(
        'button[aria-label*="Raise hand" i], button[aria-label*="Lower hand" i], button[data-tooltip*="Raise hand" i]',
      );
      if (!btn) return;
      const label = btn.getAttribute('aria-label') ?? btn.getAttribute('data-tooltip') ?? '';
      if (/lower hand/i.test(label)) return;
      emitRaise(getSelfDisplayName());
    };
    document.addEventListener('click', onRaiseClick, true);

    const checkElement = (el: Element) => {
      const label = el.getAttribute('aria-label') ?? el.textContent ?? '';
      if (!/raised.?hand|has raised|raise hand/i.test(label)) return;

      const tile = el.closest('[data-participant-id], [data-self-name], [role="listitem"]');
      const name = tile ? getNameFromTile(tile) : null;
      const nameMatch = /^(.+?)\s+(raised|has raised)/i.exec(label)?.[1]?.trim();
      emitRaise(name ?? nameMatch ?? getSelfDisplayName());
    };

    const raiseObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof Element) {
            checkElement(node);
            for (const child of node.querySelectorAll('[aria-label*="raised hand" i], [aria-label*="has raised" i]')) {
              checkElement(child);
            }
          }
        }
        if (m.type === 'attributes') checkElement(m.target as Element);
      }
    });

    raiseObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label'] });
    this.observers.push(raiseObserver);

    return () => {
      document.removeEventListener('click', onRaiseClick, true);
      raiseObserver.disconnect();
    };
  }

  onChatMessage(callback: (event: ChatEvent) => void): () => void {
    const seenMessageKeys = new Set<string>();
    const processedBlocks = new WeakSet<Element>();
    const boundInputs = new WeakSet<Element>();
    let chatObserver: MutationObserver | null = null;
    let attachedRoot: Element | null = null;

    const emitMessage = (event: ChatEvent | null) => {
      if (!event) return;
      const key = `${event.senderName}:${event.message}`;
      if (seenMessageKeys.has(key)) return;
      seenMessageKeys.add(key);
      callback(event);
    };

    const bindChatInput = (): boolean => {
      const input = findChatInput();
      if (!input || boundInputs.has(input)) return Boolean(input);
      boundInputs.add(input);
      debugLog('GoogleMeetAdapter:bindChatInput', 'chat input bound', { ariaLabel: input.getAttribute('aria-label') }, 'H-chat');

      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || event.shiftKey) return;
        const message = readInputText(input);
        const senderName = getSelfDisplayName();
        if (message && isValidChat(senderName, message)) {
          debugLog('GoogleMeetAdapter:bindChatInput', 'chat sent via enter', { senderName, message: message.slice(0, 40) }, 'H-chat');
          emitMessage({ senderName, message, timestamp: Date.now() });
        }
      }, true);

      return true;
    };

    const captureFromInput = (): void => {
      const input = findChatInput();
      if (!input) return;
      const message = readInputText(input);
      const senderName = getSelfDisplayName();
      if (message && isValidChat(senderName, message)) emitMessage({ senderName, message, timestamp: Date.now() });
    };

    const scanMessages = (root: ParentNode | Document = document) => {
      for (const node of root.querySelectorAll('[data-message-id]')) emitMessage(parseChatNode(node));
      for (const block of root.querySelectorAll('div.Ss4fHf')) {
        if (processedBlocks.has(block)) continue;
        processedBlocks.add(block);
        emitMessage(parseSs4fBlock(block));
      }
      for (const item of root.querySelectorAll('[role="log"] [role="listitem"]')) emitMessage(parseListItemChat(item));
    };

    const attachToChatPanel = (): boolean => {
      const chatRoot = findChatRoot();
      const hasMessages = Boolean(document.querySelector('[data-message-id], div.Ss4fHf, [role="log"] [role="listitem"]'));
      if (!chatRoot && !hasMessages) return false;
      if (chatRoot && attachedRoot === chatRoot && chatObserver) {
        scanMessages(chatRoot);
        return true;
      }

      attachedRoot = chatRoot;
      const scanRoot = chatRoot ?? document.body;
      debugLog('GoogleMeetAdapter:attachToChatPanel', 'chat panel attached', { hasRoot: Boolean(chatRoot) }, 'H-chat');

      scanMessages(scanRoot);
      if (chatObserver) chatObserver.disconnect();
      chatObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof Element)) continue;
            emitMessage(parseChatNode(node));
            scanMessages(node);
          }
        }
      });
      chatObserver.observe(scanRoot, { childList: true, subtree: true });
      return true;
    };

    const scheduleAttach = () => {
      window.setTimeout(() => { bindChatInput(); attachToChatPanel(); }, 400);
      window.setTimeout(() => { bindChatInput(); attachToChatPanel(); }, 1200);
    };

    bindChatInput();
    attachToChatPanel();

    const onChatClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[aria-label*="Chat with everyone" i], [aria-label*="chat" i][data-is-touch-wrapper], button[aria-label*="Chat" i], [data-tooltip*="Chat" i]')) {
        scheduleAttach();
        return;
      }
      if (target.closest('[aria-label*="Send a message" i], [aria-label*="Send message" i], [data-tooltip*="Send" i]')) {
        captureFromInput();
      }
    };
    document.addEventListener('click', onChatClick, true);

    const panelWatcher = new MutationObserver(() => attachToChatPanel());
    panelWatcher.observe(document.body, { childList: true, subtree: true });

    const pollId = window.setInterval(() => {
      bindChatInput();
      if (document.querySelector('div.Ss4fHf, [data-message-id], [aria-label*="Send a message" i]')) {
        attachToChatPanel();
      }
    }, 2_000);

    return () => {
      chatObserver?.disconnect();
      panelWatcher.disconnect();
      document.removeEventListener('click', onChatClick, true);
      window.clearInterval(pollId);
    };
  }

  onMeetingEnd(callback: () => void): () => void {
    let ended = false;

    const trigger = () => {
      if (ended) return;
      ended = true;
      callback();
    };

    const checkUrl = () => {
      if (!EXTENSION_CONSTANTS.GOOGLE_MEET_URL_PATTERN.test(window.location.href)) trigger();
    };

    const onLeaveClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest(
        'button[aria-label*="Leave call"], button[aria-label*="Leave meeting"], button[aria-label*="Hang up"], [data-tooltip*="Leave call"], [data-tooltip*="Leave meeting"]',
      );
      if (button) {
        window.setTimeout(checkUrl, 300);
        window.setTimeout(trigger, 1_500);
      }
    };

    document.addEventListener('click', onLeaveClick, true);
    const urlInterval = window.setInterval(checkUrl, 1_000);
    const observer = new MutationObserver(checkUrl);
    observer.observe(document.querySelector('title') ?? document.head, { childList: true, subtree: true, characterData: true });
    checkUrl();

    return () => {
      document.removeEventListener('click', onLeaveClick, true);
      window.clearInterval(urlInterval);
      observer.disconnect();
    };
  }

  destroy(): void {
    for (const observer of this.observers) observer.disconnect();
    this.observers = [];
    for (const cleanup of this.cleanupFns) cleanup();
    this.cleanupFns = [];
  }
}
