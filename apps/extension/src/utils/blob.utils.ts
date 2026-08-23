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
  if (trimmed.length < 2 && trimmed !== 'You') return false;
  if (/^Meet\b/i.test(trimmed)) return false;
  if (/^(mic|videocam|more_vert|keyboard_arrow|people|person|group)/i.test(trimmed)) return false;
  return true;
}

export function normalizeSelfName(name: string, selfDisplayName: string | null): string {
  if (name === 'You' && selfDisplayName && selfDisplayName !== 'You') {
    return selfDisplayName;
  }
  return name;
}
