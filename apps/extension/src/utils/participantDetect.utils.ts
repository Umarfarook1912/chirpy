import { isValidParticipantName } from './blob.utils';

export type DetectedName = {
  displayName: string;
  isSelf: boolean;
};

/**
 * Patterns that are definitely NOT participant names.
 * These are aria-label values that appear on Meet UI controls.
 */
const UI_ARIA_BLOCKLIST =
  /^(turn on|turn off|mute|unmute|raise hand|lower hand|leave call|chat with|share screen|more options|present now|activities|host controls|meeting details|people|participants|admit|deny|keep pin|copy|settings|use phone|captions|reactions|hand raise|send a message|let participants|return to|go to|getting ready|video preview|background|noise cancel|recording|spotlight|tile|full screen|accessibility|change layout|you are presenting|screen sharing|change background|blur|ring|call|dial|join|ready to join|check your|audio|video settings|open new|present a tab|a window|your entire)/i;

/**
 * Parse a Meet participants-panel or video-tile aria-label into a person name.
 * Only call this for labels that are KNOWN to be on participant-context elements,
 * not for generic page aria-labels.
 * Examples: "Umar Farook J (you)", "Jrru, muted", "Jrru is speaking"
 */
export function parseMeetParticipantLabel(label: string): DetectedName | null {
  const raw = label.trim();
  if (!raw || raw.length > 100) return null;
  if (UI_ARIA_BLOCKLIST.test(raw)) return null;
  if (/^more information/i.test(raw)) return null;
  // Reject if it contains typical UI word patterns
  if (/\b(screen|preview|background|caption|toolbar|loading|ready|effect|home)\b/i.test(raw) && raw.split(/\s+/).length <= 5) return null;
  if (/\bON$|\bOFF$/i.test(raw)) return null;

  const isSelf = /\(you\)/i.test(raw);
  let name = raw
    .replace(/\s*\(you\)/gi, '')
    .replace(/\s*\(host\)/gi, '')
    .replace(/\s+is speaking.*$/i, '')
    .replace(/\s+raised.?hand.*$/i, '')
    .replace(/\s+has raised.*$/i, '')
    .replace(/\s*,\s*(muted|unmuted|camera off|camera on|mic off|mic on).*$/i, '')
    .split(',')[0]
    ?.trim();

  if (!name) return null;
  if (/^you$/i.test(name)) {
    return isSelf ? { displayName: 'You', isSelf: true } : null;
  }
  if (!isValidParticipantName(name)) return null;
  return { displayName: name, isSelf };
}

export type RaisedHandPerson = { displayName: string; isSelf: boolean };

/**
 * Meet's raised-hands list is one concatenated text node, for example:
 * "Lower allUmar Farook J(You)Meeting hostfront_handLower"
 * "Lower allJrrufront_handLower"
 */
export function parseRaisedHandList(text: string): RaisedHandPerson[] {
  const results: RaisedHandPerson[] = [];
  const seen = new Set<string>();
  const re = /(?:Lower(?: all)?|Hand raises)([\s\S]+?)front_hand/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const raw = match[1] ?? '';
    const isSelf = /\(you\)/i.test(raw);
    const name = raw
      .replace(/\(you\)/gi, '')
      .replace(/meeting host/gi, '')
      .replace(/keyboard_arrow_down/gi, '')
      .trim();
    if (!isValidParticipantName(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ displayName: name, isSelf });
  }
  return results;
}

/** Prefer real name over the literal "You" Meet sometimes puts in data-self-name. */
export function preferRealName(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    const t = c?.trim();
    if (!t || /^you$/i.test(t)) continue;
    if (isValidParticipantName(t)) return t;
  }
  for (const c of candidates) {
    const t = c?.trim();
    if (t && /^you$/i.test(t)) return 'You';
  }
  return null;
}

/**
 * Deduplicate participant detections. Self entries win the isSelf flag.
 */
export function mergeDetectedNames(entries: DetectedName[]): DetectedName[] {
  const byKey = new Map<string, DetectedName>();
  for (const entry of entries) {
    const key = entry.displayName.toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...entry });
      continue;
    }
    if (entry.isSelf) existing.isSelf = true;
  }
  return Array.from(byKey.values());
}

/**
 * Build participant list from aria-labels + explicit name strings (tile overlays).
 * Pure / DOM-free so unit tests can lock multi-person Meet scenarios.
 */
export function collectParticipantsFromSignals(input: {
  ariaLabels: string[];
  overlayNames?: string[];
  selfNameHint?: string | null;
}): DetectedName[] {
  const found: DetectedName[] = [];

  for (const label of input.ariaLabels) {
    const parsed = parseMeetParticipantLabel(label);
    if (parsed) found.push(parsed);
  }

  for (const overlay of input.overlayNames ?? []) {
    const name = preferRealName(overlay);
    if (name) found.push({ displayName: name, isSelf: false });
  }

  const selfHint = preferRealName(input.selfNameHint ?? null);
  if (selfHint) {
    found.push({ displayName: selfHint, isSelf: true });
  }

  const merged = mergeDetectedNames(found);

  // If we know the real self name, mark that row as self and drop a bare "You" row
  if (selfHint && !/^you$/i.test(selfHint)) {
    const selfKey = selfHint.toLowerCase();
    for (const row of merged) {
      if (row.displayName.toLowerCase() === selfKey) row.isSelf = true;
    }
    return merged.filter((r) => !/^you$/i.test(r.displayName));
  }

  return merged;
}

/**
 * Attendance must differ when host joined earlier than a late peer.
 * Speaking must never exceed that person's attendance.
 */
export function finalizeParticipantStats(
  rows: Array<{
    displayName: string;
    attendanceDurationSeconds: number;
    chatMessageCount: number;
    handRaiseCount: number;
    reactionCount: number;
    speakingDurationSeconds: number;
  }>,
): typeof rows {
  return rows.map((row) => {
    const attendance = Math.max(0, row.attendanceDurationSeconds);
    let speaking = Math.max(0, row.speakingDurationSeconds);
    if (attendance > 0 && speaking > attendance) speaking = attendance;
    return { ...row, attendanceDurationSeconds: attendance, speakingDurationSeconds: speaking };
  });
}
