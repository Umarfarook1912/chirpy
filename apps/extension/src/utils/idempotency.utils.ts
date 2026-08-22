export function generateIdempotencyKey(
  externalMeetingId: string,
  startedAt: number,
): string {
  const base = `${externalMeetingId}-${startedAt}`;
  return generateUUID(base);
}

function generateUUID(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }

  const positiveHash = Math.abs(hash);
  const hex = positiveHash.toString(16).padStart(8, '0');
  const time = Date.now().toString(16).padStart(12, '0');

  return `${hex.slice(0, 8)}-${time.slice(0, 4)}-4${time.slice(4, 7)}-8${hex.slice(1, 4)}-${time.slice(0, 12)}`;
}

export function getSessionKey(externalMeetingId: string): string {
  return `chirpy-session-${externalMeetingId}`;
}
