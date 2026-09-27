import type { MeetingPlatformAdapter } from './MeetingPlatformAdapter';
import type { MeetingInfo, DetectedParticipant, ChatEvent, SpeakingEvent } from '../../types/extension.types';
import { EXTENSION_CONSTANTS } from '../../constants/extension.constants';
import { isValidParticipantName } from '../../utils/blob.utils';
import {
  collectParticipantsFromSignals,
  parseMeetParticipantLabel,
  parseRaisedHandList,
  preferRealName,
} from '../../utils/participantDetect.utils';

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

let observedSelfName: string | null = null;

/** Resolve the local user's real display name (never prefer a peer tile). */
export function getSelfDisplayName(): string {
  const selfTile =
    document.querySelector('[data-is-self]') ??
    document.querySelector('[data-self-name][data-is-self]');

  const fromTile = selfTile ? getNameFromTile(selfTile) : null;
  const fromOverlay = selfTile ? extractOverlayName(selfTile) : null;

  let fromAria: string | null = null;
  for (const el of document.querySelectorAll('[aria-label*="(you)" i]')) {
    const parsed = parseMeetParticipantLabel(el.getAttribute('aria-label') ?? '');
    if (parsed && !/^you$/i.test(parsed.displayName)) {
      fromAria = parsed.displayName;
      break;
    }
  }

  const attr = document
    .querySelector('[data-self-name][data-is-self], [data-self-name]')
    ?.getAttribute('data-self-name')
    ?.trim();

  const fromYouText = readSelfNameFromYouText();

  return preferRealName(fromAria, fromOverlay, fromTile, attr, fromYouText, observedSelfName) ?? 'You';
}

/** People-panel text is "Umar Farook J(You)Meeting host" even when aria is only the name. */
function readSelfNameFromYouText(): string | null {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let steps = 0;
  while (node && steps < 300) {
    steps += 1;
    if (!/\(you\)/i.test(node.textContent ?? '')) {
      node = walker.nextNode();
      continue;
    }
    let el: Element | null = node.parentElement;
    for (let depth = 0; el && depth < 4; depth += 1) {
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text.length > 120) break;
      const match = /^([A-Za-z][^()]{1,40}?)\s*\(you\)/i.exec(text);
      const name = match?.[1]?.trim();
      if (name && isValidParticipantName(name)) {
        observedSelfName = name;
        return name;
      }
      el = el.parentElement;
    }
    node = walker.nextNode();
  }
  return null;
}

function readInputText(input: HTMLElement): string {
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
    return input.value.trim();
  }
  return input.innerText?.trim() ?? '';
}

// ─── Participant name extraction from tile ───────────────────────────────────

/**
 * Extract name from a tile's data-tooltip or LEAF text content only.
 *
 * IMPORTANT: We must NOT call el.textContent on elements that have child elements —
 * that concatenates all child text and produces doubled names like
 * "Umar Farook JUmar Farook J" or "JmuJrru" (avatar initial + name).
 */
function extractOverlayName(tile: Element): string | null {
  // 1. data-tooltip anywhere in the tile — always a single clean string
  for (const el of tile.querySelectorAll('[data-tooltip]')) {
    const tooltip = el.getAttribute('data-tooltip')?.trim();
    const name = preferRealName(tooltip);
    if (name && !/^you$/i.test(name)) return name;
  }

  // 2. Known name-badge class names — only use LEAF elements (no child elements)
  //    so we never concatenate nested text nodes.
  const badgeSelectors = [
    '.KF4T6b', '.ZjFb7c', '.zWGUib', '.XEazBc',
    '[class*="participantName"]', '[class*="name-label"]', '[class*="ParticipantName"]',
  ];
  for (const sel of badgeSelectors) {
    for (const el of tile.querySelectorAll(sel)) {
      // Skip non-leaf elements — textContent on parents combines all child text
      if (el.children.length > 0) continue;
      const text = el.textContent?.trim();
      const name = preferRealName(text);
      if (name && !/^you$/i.test(name)) return name;
    }
  }

  return null;
}

/**
 * Given a participant tile element, extract the display name using safe sources only.
 * Priority: tile aria-label → data-self-name attribute → leaf overlay text.
 * NEVER use textContent on composite elements — that produces doubled strings.
 */
function getNameFromTile(tile: Element): string | null {
  // Tile-level aria-label is the most reliable: Meet sets it to "Name (you)" / "Name, muted"
  const ariaLabel = tile.getAttribute('aria-label');
  const fromAria = ariaLabel ? parseMeetParticipantLabel(ariaLabel)?.displayName : null;
  if (fromAria && !/^you$/i.test(fromAria)) return fromAria;

  // data-self-name attribute — set by Meet directly, single string
  const attr = tile.getAttribute('data-self-name')?.trim();
  if (attr && !/^you$/i.test(attr) && isValidParticipantName(attr)) return attr;

  // Overlay leaf text as last resort
  const overlay = extractOverlayName(tile);
  if (overlay) return overlay;

  // Accept "You" only from aria-label (so we can resolve it later)
  if (fromAria === 'You') return 'You';
  if (attr && /^you$/i.test(attr)) return 'You';

  return null;
}

function doubledSpeakingName(raw: string): string | null {
  let text = raw.replace(/\s+/g, ' ').trim();
  const cut = text.search(/frame_person|reframe|visual_effects|backgrounds/i);
  if (cut === 0) return null;
  if (cut > 0) text = text.slice(0, cut).trim();
  text = text.replace(/^(front_hand|back_hand)\s*/i, '');
  text = text.replace(/\s*(devices|more_vert|more actions).*$/i, '').trim();
  if (text.length < 4 || text.length % 2 !== 0) return null;
  const half = text.length / 2;
  if (text.slice(0, half) !== text.slice(half)) return null;
  const name = text.slice(0, half).trim();
  if (!isValidParticipantName(name) || /^you$/i.test(name)) return null;
  return name;
}

/**
 * The active-speaker class sits on a tile whose text is the name twice,
 * plus a suffix: "JrruJrrudevices" or "front_handJrruJrrudevices".
 * That text is on the participant tile, not always on the highlight element.
 * The toolbar tile ("frame_personReframe...") is not a person.
 */
function nameFromSpeakingTile(marker: Element): string | null {
  const tile = marker.closest('[data-participant-id]');
  const candidates = [tile?.textContent ?? '', marker.textContent ?? '', marker.parentElement?.textContent ?? ''];
  for (const candidate of candidates) {
    const compact = candidate.replace(/\s+/g, ' ').trim();
    if (compact.length < 4 || compact.length > 160) continue;
    const name = doubledSpeakingName(compact);
    if (name) return name;
  }
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
  const speakingMatch =
    /^(.+?)\s+is speaking/i.exec(label) ??
    /^(.+?)\s+\(.*\)\s+is speaking/i.exec(label);
  if (speakingMatch?.[1]) {
    const name = speakingMatch[1].replace(/\s*\(you\)\s*$/i, '').trim();
    return isValidParticipantName(name) ? name : null;
  }

  if (tile.getAttribute('data-is-speaking') === 'true') {
    const name = getNameFromTile(tile);
    return name && isValidParticipantName(name) ? name : null;
  }

  // Active border / waveform indicators used across Meet versions
  const hasSpeakingIndicator =
    tile.querySelector(
      [
        '.YEI2ub',
        '.KV1GEc',
        '.kssMZb',
        '[class*="speaking-indicator"]',
        '[class*="speakingIndicator"]',
        '[class*="audioLevel"]',
        '[jsname="Qg9Jr"]',
        'div[style*="box-shadow"][style*="rgb"]',
      ].join(', '),
    ) !== null;

  // Some builds put speaking state on the tile class itself
  const tileLooksActive = /\bspeaking\b/i.test(tile.className);

  if (hasSpeakingIndicator || tileLooksActive) {
    const name = getNameFromTile(tile);
    return name && isValidParticipantName(name) ? name : null;
  }

  return null;
}

/** Scan whole document for Meet "is speaking" aria labels (covers non-tile layouts). */
function detectSpeakersFromDocument(): string[] {
  const names: string[] = [];
  for (const el of document.querySelectorAll('[aria-label*="is speaking" i]')) {
    const label = el.getAttribute('aria-label') ?? '';
    const match = /^(.+?)\s+is speaking/i.exec(label);
    if (!match?.[1]) continue;
    const name = match[1].replace(/\s*\(you\)\s*$/i, '').trim();
    if (isValidParticipantName(name) && !names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * Only look at DOM elements that are semantically "participant tiles".
 * NEVER scan all [aria-label] elements — that picks up UI controls as names.
 */
function collectParticipantNames(): DetectedParticipant[] {
  const seen = new Set<string>();
  const results: DetectedParticipant[] = [];

  const add = (name: string | null, isSelf: boolean) => {
    if (!name) return;
    const clean = name.trim();
    if (!isValidParticipantName(clean) && !/^you$/i.test(clean)) return;
    if (seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());
    results.push({ displayName: clean, isSelf, isSpeaking: false });
  };

  // ── Strategy 1: Video / audio tiles that Meet renders for each person ──
  // These data-attributes are only placed on participant containers, not UI controls.
  const tileSel = [
    '[data-participant-id]',
    '[data-self-name]',
    '[data-is-self]',
    '[data-requested-participant-id]',
    '[data-allocation-index]',
  ].join(', ');

  for (const tile of document.querySelectorAll(tileSel)) {
    const isSelf = tile.hasAttribute('data-is-self');
    const name = getNameFromTile(tile);
    add(name, isSelf);
  }

  // ── Strategy 2: People / participants panel list items (only when panel open) ──
  // Meet puts one [role="listitem"] per person with an aria-label like "Name, muted".
  const peoplePanelItem = [
    '[data-panel-id="people"] [role="listitem"]',
    '[aria-label="Participants"] [role="listitem"]',
    '[aria-label^="People"] [role="listitem"]',
    '[jsname][role="list"] [role="listitem"]',
  ].join(', ');

  for (const item of document.querySelectorAll(peoplePanelItem)) {
    const label = item.getAttribute('aria-label') ?? '';
    if (!label || /^more information/i.test(label)) continue;
    const parsed = parseMeetParticipantLabel(label);
    if (parsed) add(parsed.displayName, parsed.isSelf);
  }

  // ── Strategy 3: Always include the known self name ──
  const selfName = getSelfDisplayName();
  add(selfName, true);

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
   * Snapshot of who is currently visible in Meet (for flush-before-sync).
   */
  getVisibleParticipants(): DetectedParticipant[] {
    try {
      return collectParticipantNames();
    } catch {
      return [];
    }
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

    const pollId = window.setInterval(() => callback(getParticipants()), 1_000);
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

      if (!speaker || currentSpeakers.has(name)) return;
      currentSpeakers.add(name);
      callback(name, true);
    };

    const scanAllTiles = () => {
      const activeFromDoc = new Set(detectSpeakersFromDocument());

      for (const tile of document.querySelectorAll('[data-participant-id], [data-self-name]')) {
        evalTile(tile);
        const speaker = detectSpeakerFromTile(tile);
        if (speaker) activeFromDoc.add(speaker);
      }

      const selfName = getSelfDisplayName();
      for (const marker of document.querySelectorAll('.atLQQ.kssMZb')) {
        const name = nameFromSpeakingTile(marker);
        if (!name || !isValidParticipantName(name)) continue;
        if (/^you$/i.test(name)) continue;
        if (selfName && name.toLowerCase() === selfName.toLowerCase()) continue;
        activeFromDoc.add(name);
      }

      for (const name of activeFromDoc) {
        if (!currentSpeakers.has(name) && isValidParticipantName(name)) {
          currentSpeakers.add(name);
          callback(name, true);
        }
      }

      for (const name of Array.from(currentSpeakers)) {
        if (!activeFromDoc.has(name)) {
          // Keep if tile still reports speaking
          const stillOnTile = Array.from(
            document.querySelectorAll('[data-participant-id], [data-self-name]'),
          ).some((t) => detectSpeakerFromTile(t) === name);
          if (!stillOnTile) {
            currentSpeakers.delete(name);
            callback(name, false);
          }
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
   * Google Meet DOM varies by locale/version — use several selectors.
   */
  onMicActivity(callback: (participantName: string, speaking: boolean) => void): () => void {
    let speaking = false;

    const isMicUnmuted = (): boolean => {
      // Unmuted: button that will "Turn off / Mute" the mic
      const unmuteControl = document.querySelector(
        [
          'button[aria-label*="Turn off microphone" i]',
          'button[aria-label*="Mute microphone" i]',
          'button[aria-label="Mute" i]',
          'button[data-is-muted="false"][aria-label*="microphone" i]',
          'button[data-is-muted="false"][aria-label*="mic" i]',
          'div[role="button"][aria-label*="Turn off microphone" i]',
        ].join(', '),
      );
      if (unmuteControl) return true;

      // Muted: explicit "Turn on / Unmute" — treat as not speaking
      const muteControl = document.querySelector(
        [
          'button[aria-label*="Turn on microphone" i]',
          'button[aria-label*="Unmute microphone" i]',
          'button[aria-label="Unmute" i]',
          'button[data-is-muted="true"][aria-label*="microphone" i]',
        ].join(', '),
      );
      if (muteControl) return false;

      const selfTile = document.querySelector('[data-is-self], [data-self-name][data-is-self]');
      if (selfTile?.getAttribute('data-is-muted') === 'false') return true;
      if (selfTile?.getAttribute('data-is-muted') === 'true') return false;

      return false;
    };

    const checkMic = () => {
      const name = getSelfDisplayName();
      const active = isMicUnmuted();

      if (active && !speaking) {
        speaking = true;
        callback(name, true);
      } else if (!active && speaking) {
        speaking = false;
        callback(name, false);
      }
    };

    const onMicClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('button[aria-label*="microphone" i], button[aria-label*="mic" i], button[aria-label="Mute" i], button[aria-label="Unmute" i]')) {
        return;
      }
      window.setTimeout(checkMic, 200);
      window.setTimeout(checkMic, 600);
    };
    document.addEventListener('click', onMicClick, true);

    const pollId = window.setInterval(checkMic, 500);
    checkMic();
    this.cleanupFns.push(() => {
      window.clearInterval(pollId);
      document.removeEventListener('click', onMicClick, true);
    });
    return () => {
      window.clearInterval(pollId);
      document.removeEventListener('click', onMicClick, true);
    };
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
    const raisedNow = new Set<string>();
    const lastSignalAt = new Map<string, number>();
    let lastSeenPanel = 0;

    const noteRaised = (
      people: Array<{ displayName: string; isSelf: boolean }>,
      fullList: boolean,
    ) => {
      const present = new Set<string>();
      const now = Date.now();
      if (people.length > 0) lastSeenPanel = now;
      for (const person of people) {
        const key = person.displayName.toLowerCase();
        present.add(key);
        if (person.isSelf) observedSelfName = person.displayName;
        const previous = lastSignalAt.get(key) ?? 0;
        // A new render burst several seconds later is another raise. The icon
        // often stays in the DOM between a remote user's lower and the next raise.
        const newBurst = previous > 0 && now - previous > 2_000;
        lastSignalAt.set(key, now);
        if (raisedNow.has(key) && !newBurst) continue;
        raisedNow.add(key);
        callback(person.displayName, now);
      }
      if (fullList) {
        for (const key of [...raisedNow]) {
          if (!present.has(key)) raisedNow.delete(key);
        }
      }
    };

    const readRaisedPeople = (): Map<string, { displayName: string; isSelf: boolean }> => {
      const found = new Map<string, { displayName: string; isSelf: boolean }>();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let node: Node | null;
      let scanned = 0;
      while ((node = walker.nextNode()) && scanned < 4000) {
        if (!(node instanceof Element)) continue;
        scanned += 1;
        const text = node.textContent ?? '';
        if (text.length < 12 || text.length > 400) continue;
        if (!text.includes('front_hand') || !/Lower all|Hand raises/i.test(text)) continue;
        for (const person of parseRaisedHandList(text)) {
          found.set(person.displayName.toLowerCase(), person);
        }
      }
      return found;
    };

    const syncRaisedHands = () => {
      const found = readRaisedPeople();
      if (found.size > 0) {
        lastSeenPanel = Date.now();
        return;
      }
      if (lastSeenPanel !== 0 && Date.now() - lastSeenPanel > 1_000) {
        raisedNow.clear();
        lastSeenPanel = 0;
      }
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
      syncRaisedHands();
    };
    document.addEventListener('click', onRaiseClick, true);

    const checkElement = (el: Element) => {
      const label = el.getAttribute('aria-label') ?? el.textContent ?? '';
      if (!/raised.?hand|has raised|front_hand/i.test(label)) return;

      const people = parseRaisedHandList(label);
      const fullList = /Lower all/i.test(label) && /front_hand/i.test(label);
      if (people.length > 0) noteRaised(people, fullList);
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

    const pollId = window.setInterval(syncRaisedHands, 400);
    this.cleanupFns.push(() => window.clearInterval(pollId));

    return () => {
      document.removeEventListener('click', onRaiseClick, true);
      raiseObserver.disconnect();
      window.clearInterval(pollId);
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

      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || event.shiftKey) return;
        const message = readInputText(input);
        const senderName = getSelfDisplayName();
        if (message && isValidChat(senderName, message)) {
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
