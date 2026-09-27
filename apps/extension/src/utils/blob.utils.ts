const CHUNK_SIZE = 512 * 1024;

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return arrayBufferToDataUrl(buffer, blob.type || 'video/webm');
}

export function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${mimeType || 'video/webm'};base64,${btoa(binary)}`;
}

/** Split blob into base64 chunks safe for extension message passing */
export async function blobToBase64Chunks(blob: Blob): Promise<string[]> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];

  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const slice = bytes.subarray(offset, offset + CHUNK_SIZE);
    let binary = '';
    for (let i = 0; i < slice.length; i += 0x8000) {
      binary += String.fromCharCode(...slice.subarray(i, i + 0x8000));
    }
    chunks.push(btoa(binary));
  }

  return chunks;
}

export function base64ChunksToBlob(chunks: string[], mimeType: string): Blob {
  const parts: BlobPart[] = [];
  for (const chunk of chunks) {
    const binary = atob(chunk);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    parts.push(bytes);
  }
  return new Blob(parts, { type: mimeType || 'video/webm' });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) throw new Error('Invalid data URL — missing base64 payload');
  const header = dataUrl.slice(0, commaIdx);
  const base64 = dataUrl.slice(commaIdx + 1).replace(/\s/g, '');
  const mimeMatch = header.match(/:(.*?);/);
  const mimeType = mimeMatch?.[1] ?? 'video/webm';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export function downloadBlobInPage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

export function sanitizeDownloadFilename(title: string, extension: string): string {
  const safeTitle = title.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'meeting';
  return `chirpy-${safeTitle}.${extension}`;
}

export function isValidParticipantName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed === 'Unknown') return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (trimmed.length < 2) return false;
  // Names over 60 chars are almost certainly not people names
  if (trimmed.length > 60) return false;
  // Loading / ellipsis patterns
  if (/\.{2,}/.test(trimmed)) return false;
  // "... is ON" / "... is OFF" patterns (settings toggles)
  if (/\bON$|\bOFF$|\bIS ON\b|\bIS OFF\b/i.test(trimmed)) return false;
  // Google Meet UI element names
  if (/^Meet\b/i.test(trimmed)) return false;

  // Common Meet UI verbs/nouns that appear in aria-labels but are never person names
  if (
    /^(return|go to|back to|open|close|view|switch|toggle|enable|disable|turn on|turn off|getting|send a|copy|paste|delete|remove from)/i.test(trimmed)
  ) return false;

  // Full list of Meet chrome strings that have been seen as false positives
  if (
    /^(more information|about|participants?|people|keep pin|pin\b|unpin|mute|unmute|remove|admit|deny|host controls|meeting tools|share screen|raise hand|lower hand|chat with|in-call messages|let participants|return to|video preview|backgrounds and|getting ready|captions for|use a phone|accessibility|recording|noise cancellation|change layout|spotlight|tile view|full screen|present now|you are|your |screen is|camera is|mic is)/i.test(trimmed)
  ) return false;

  // Material icon ligature names / internal identifiers
  if (/^(mic|videocam|more_vert|keyboard_arrow|person\b|group\b|front_hand|back_hand|call_end|settings|info\b|apps\b|lock|alarm|volume|devices|frame|reframe|visual_effects)/i.test(trimmed)) {
    return false;
  }

  // Reject strings that contain UI-specific keywords
  if (/\b(screen|preview|home screen|background|caption|toolbar|controls|loading|ready|effect)\b/i.test(trimmed) && trimmed.split(/\s+/).length <= 4) {
    return false;
  }

  // More than 5 words → almost certainly not a name
  if (trimmed.split(/\s+/).length > 5) return false;

  // Detect doubled/concatenated strings like "Umar Farook JUmar Farook J".
  // These come from el.textContent on Meet composite elements that have two child spans.
  const half = Math.floor(trimmed.length / 2);
  if (half > 3 && trimmed.slice(0, half) === trimmed.slice(half)) return false;

  // Detect avatar-initial + name concatenations without whitespace,
  // e.g. "JmuJrru" (avatar "J" + partial "mu" + name "Jrru") or "AAlice".
  // Heuristic: a lowercase letter or run of lowercase immediately follows an uppercase
  // letter that is itself immediately after another character with no space → concat artifact.
  // Simpler: reject strings with no spaces that mix uppercase mid-string in unusual positions
  // AND are longer than one typical short name (>7 chars, single word with CamelCase inside).
  if (!/\s/.test(trimmed) && trimmed.length > 6) {
    // Count uppercase letters that appear after position 0 (camel-case indicators)
    const midUpper = (trimmed.slice(1).match(/[A-Z]/g) ?? []).length;
    if (midUpper >= 2) return false;  // e.g. "JmuJrru" has "J" at pos 3 and that's 1 mid-upper... need >=1
  }
  if (!/\s/.test(trimmed) && trimmed.length > 5) {
    const midUpper = (trimmed.slice(1).match(/[A-Z]/g) ?? []).length;
    if (midUpper >= 1 && trimmed.length > 6) return false;
  }

  // Contains "about" or "information" without other context → UI label
  if (/\b(about|information)\b/i.test(trimmed) && trimmed.split(/\s+/).length <= 4) {
    return false;
  }

  return true;
}

export function normalizeSelfName(name: string, selfDisplayName: string | null): string {
  if (/^you$/i.test(name.trim()) && selfDisplayName && !/^you$/i.test(selfDisplayName)) {
    return selfDisplayName;
  }
  return name;
}
