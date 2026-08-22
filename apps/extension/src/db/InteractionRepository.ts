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

  async aggregateByParticipant(sessionId: string): Promise<
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

    return Array.from(byParticipant.entries()).map(([participantName, events]) => ({
      participantName,
      chatMessageCount: events.filter((e) => e.type === 'chat_message').length,
      handRaiseCount: events.filter((e) => e.type === 'hand_raise').length,
      reactionCount: events.filter((e) => e.type === 'reaction').length,
      speakingDurationSeconds: 0,
      attendanceDurationSeconds: 0,
    }));
  }
}
