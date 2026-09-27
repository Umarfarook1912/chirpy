import { db, type LocalInteraction } from './db';

export class InteractionRepository {
  async addInteraction(
    interaction: Omit<LocalInteraction, 'id'>,
  ): Promise<number | undefined> {
    return db.interactions.add(interaction);
  }

  async getBySession(sessionId: string): Promise<LocalInteraction[]> {
    return db.interactions.where('sessionId').equals(sessionId).toArray();
  }

  async deleteBySession(sessionId: string): Promise<void> {
    await db.interactions.where('sessionId').equals(sessionId).delete();
  }

  /**
   * Attendance = sum of present segments only (join→leave), not wall-clock first→last.
   * Open segment at sync: lastJoin → sessionEndedAt (or now).
   */
  async aggregateByParticipant(
    sessionId: string,
    sessionEndedAt?: number,
  ): Promise<
    Array<{
      participantName: string;
      chatMessageCount: number;
      handRaiseCount: number;
      reactionCount: number;
      speakingDurationSeconds: number;
      attendanceDurationSeconds: number;
    }>
  > {
    const interactions = await this.getBySession(sessionId);
    const endTs = sessionEndedAt ?? Date.now();

    const byParticipant = new Map<string, LocalInteraction[]>();
    for (const interaction of interactions) {
      const existing = byParticipant.get(interaction.participantName) ?? [];
      existing.push(interaction);
      byParticipant.set(interaction.participantName, existing);
    }

    return Array.from(byParticipant.entries()).map(([participantName, events]) => {
      const chatMessageCount = events.filter((e) => e.type === 'chat_message').length;
      const handRaiseCount = events.filter((e) => e.type === 'hand_raise').length;
      const reactionCount = events.filter((e) => e.type === 'reaction').length;

      const attendanceDurationSeconds = sumAttendanceSegments(events, endTs);
      const speakingDurationSeconds = sumSpeakingSeconds(events);

      return {
        participantName,
        chatMessageCount,
        handRaiseCount,
        reactionCount,
        speakingDurationSeconds,
        attendanceDurationSeconds,
      };
    });
  }
}

export function sumAttendanceSegments(
  events: Array<{ type: string; timestamp: number; metadata?: Record<string, unknown> }>,
  sessionEndedAt: number,
): number {
  const timeline = [...events].sort((a, b) => a.timestamp - b.timestamp);
  let attendance = 0;
  let openJoin: number | null = null;

  for (const event of timeline) {
    if (event.type === 'join') {
      openJoin = event.timestamp;
      continue;
    }
    if (event.type === 'leave') {
      const metaDuration = event.metadata?.['durationSeconds'];
      if (typeof metaDuration === 'number' && metaDuration >= 0) {
        attendance += metaDuration;
        openJoin = null;
        continue;
      }
      if (openJoin !== null) {
        attendance += Math.max(0, Math.round((event.timestamp - openJoin) / 1_000));
        openJoin = null;
      }
    }
  }

  // Still present at sync — count open segment only
  if (openJoin !== null) {
    attendance += Math.max(1, Math.round((sessionEndedAt - openJoin) / 1_000));
  }

  return attendance;
}

export function sumSpeakingSeconds(
  events: Array<{ type: string; timestamp: number; metadata?: Record<string, unknown> }>,
): number {
  const precomputed = events
    .filter(
      (e) =>
        e.type === 'speaking_end' && typeof e.metadata?.['durationSeconds'] === 'number',
    )
    .reduce((sum, e) => sum + (e.metadata!['durationSeconds'] as number), 0);

  if (precomputed > 0) return precomputed;

  const starts = events
    .filter((e) => e.type === 'speaking_start')
    .map((e) => e.timestamp)
    .sort((a, b) => a - b);
  const ends = events
    .filter((e) => e.type === 'speaking_end')
    .map((e) => e.timestamp)
    .sort((a, b) => a - b);

  let speaking = 0;
  let endIdx = 0;
  for (const start of starts) {
    const matchingEnd = ends.find((e, i) => i >= endIdx && e > start);
    if (matchingEnd) {
      speaking += Math.round((matchingEnd - start) / 1_000);
      endIdx = ends.indexOf(matchingEnd) + 1;
    }
  }
  return speaking;
}
