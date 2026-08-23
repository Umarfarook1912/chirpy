export function generateIdempotencyKey(
  externalMeetingId: string,
  startedAt: number,
): string {
  const seed = `${externalMeetingId}-${startedAt}`;
  return seedToUuid(seed);
}

function seedToUuid(seed: string): string {
  const bytes = new Uint8Array(16);
  let h1 = 2166136261;
  let h2 = 16777619;
  let h3 = 0x9e3779b9;
  let h4 = 0x85ebca6b;

  for (let i = 0; i < seed.length; i += 1) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
    h3 = Math.imul(h3 ^ c, 3266489917) ^ (h3 >>> 13);
    h4 = Math.imul(h4 ^ c, 668265263) ^ (h4 << 5);
    bytes[i % 16] ^= c & 0xff;
  }

  bytes[0] = (h1 >>> 24) & 0xff;
  bytes[1] = (h1 >>> 16) & 0xff;
  bytes[2] = (h1 >>> 8) & 0xff;
  bytes[3] = h1 & 0xff;
  bytes[4] = (h2 >>> 24) & 0xff;
  bytes[5] = (h2 >>> 16) & 0xff;
  bytes[6] = (h2 >>> 8) & 0xff;
  bytes[7] = h2 & 0xff;
  bytes[8] = (h3 >>> 24) & 0xff;
  bytes[9] = (h3 >>> 16) & 0xff;
  bytes[10] = (h3 >>> 8) & 0xff;
  bytes[11] = h3 & 0xff;
  bytes[12] = (h4 >>> 24) & 0xff;
  bytes[13] = (h4 >>> 16) & 0xff;
  bytes[14] = (h4 >>> 8) & 0xff;
  bytes[15] = h4 & 0xff;

  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getSessionKey(externalMeetingId: string): string {
  return `chirpy-session-${externalMeetingId}`;
}
