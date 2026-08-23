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

  async aggregateByParticipant(
    sessionId: string,
    sessionDurationSeconds?: number,
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

    const byParticipant = new Map<string, LocalInteraction[]>();
    for (const interaction of interactions) {
      const existing = byParticipant.get(interaction.participantName) ?? [];
      existing.push(interaction);
      byParticipant.set(interaction.participantName, existing);
    }

    return Array.from(byParticipant.entries()).map(([participantName, events]) => {
      // ── Chat & hand raise counts ────────────────────────────────────────
      const chatMessageCount = events.filter((e) => e.type === 'chat_message').length;
      const handRaiseCount = events.filter((e) => e.type === 'hand_raise').length;
      const reactionCount = events.filter((e) => e.type === 'reaction').length;

      // ── Attendance: first join → last leave (or use precomputed duration) ─
      const joins = events.filter((e) => e.type === 'join').map((e) => e.timestamp).sort((a, b) => a - b);
      const leaves = events.filter((e) => e.type === 'leave').map((e) => e.timestamp).sort((a, b) => a - b);

      // Sum up precomputed leave durations (stored in metadata.durationSeconds)
      const precomputed = events
        .filter((e) => e.type === 'leave' && typeof (e.metadata as Record<string, unknown> | undefined)?.durationSeconds === 'number')
        .reduce((sum, e) => sum + ((e.metadata as Record<string, unknown>).durationSeconds as number), 0);

      let attendanceDurationSeconds = precomputed;

      // Fallback: compute from join/leave pairs
      if (attendanceDurationSeconds === 0 && joins.length > 0) {
        const latestLeave = leaves.length > 0 ? Math.max(...leaves) : Date.now();
        const firstJoin = joins[0]!;
        attendanceDurationSeconds = Math.max(1, Math.round((latestLeave - firstJoin) / 1_000));
      }

      // Last resort: use full session duration
      if (attendanceDurationSeconds === 0 && sessionDurationSeconds) {
        attendanceDurationSeconds = sessionDurationSeconds;
      }

      // ── Speaking: sum of precomputed durations from speaking_end metadata ─
      const precomputedSpeaking = events
        .filter(
          (e) =>
            e.type === 'speaking_end' &&
            typeof (e.metadata as Record<string, unknown> | undefined)?.durationSeconds === 'number',
        )
        .reduce((sum, e) => sum + ((e.metadata as Record<string, unknown>).durationSeconds as number), 0);

      // Fallback: compute from speaking_start / speaking_end pairs
      let speakingDurationSeconds = precomputedSpeaking;
      if (speakingDurationSeconds === 0) {
        const starts = events
          .filter((e) => e.type === 'speaking_start')
          .map((e) => e.timestamp)
          .sort((a, b) => a - b);
        const ends = events
          .filter((e) => e.type === 'speaking_end')
          .map((e) => e.timestamp)
          .sort((a, b) => a - b);

        let endIdx = 0;
        for (const start of starts) {
          const matchingEnd = ends.find((e, i) => i >= endIdx && e > start);
          if (matchingEnd) {
            speakingDurationSeconds += Math.round((matchingEnd - start) / 1_000);
            endIdx = ends.indexOf(matchingEnd) + 1;
          }
        }
      }

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
