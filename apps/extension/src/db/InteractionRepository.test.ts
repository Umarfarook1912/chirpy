import { describe, expect, it, beforeEach } from 'vitest';
import { InteractionRepository } from '../db/InteractionRepository';
import type { LocalInteraction } from '../db/db';

// Minimal mock of the Dexie table used by InteractionRepository
const mockInteractions: Array<Omit<LocalInteraction, 'id'> & { id: number }> = [];
let nextId = 1;

vi.mock('../db/db', () => ({
  db: {
    interactions: {
      add: async (row: Omit<LocalInteraction, 'id'>) => {
        const id = nextId++;
        mockInteractions.push({ ...row, id });
        return id;
      },
      where: (field: string) => ({
        equals: (value: string) => ({
          toArray: async () => mockInteractions.filter((r) => (r as Record<string, unknown>)[field] === value),
          delete: async () => {
            const toRemove = mockInteractions.filter((r) => (r as Record<string, unknown>)[field] === value);
            for (const r of toRemove) mockInteractions.splice(mockInteractions.indexOf(r), 1);
          },
        }),
      }),
    },
  },
}));

const SESSION = 'test-session-001';

beforeEach(() => {
  mockInteractions.length = 0;
  nextId = 1;
});

const repo = new InteractionRepository();

describe('InteractionRepository.aggregateByParticipant', () => {
  it('counts chat messages correctly', async () => {
    await repo.addInteraction({ sessionId: SESSION, participantName: 'Alice', type: 'chat_message', timestamp: 1000 });
    await repo.addInteraction({ sessionId: SESSION, participantName: 'Alice', type: 'chat_message', timestamp: 2000 });
    await repo.addInteraction({ sessionId: SESSION, participantName: 'Bob', type: 'chat_message', timestamp: 3000 });

    const results = await repo.aggregateByParticipant(SESSION);
    const alice = results.find((r) => r.participantName === 'Alice')!;
    const bob = results.find((r) => r.participantName === 'Bob')!;

    expect(alice.chatMessageCount).toBe(2);
    expect(bob.chatMessageCount).toBe(1);
  });

  it('counts hand raises correctly', async () => {
    await repo.addInteraction({ sessionId: SESSION, participantName: 'Alice', type: 'hand_raise', timestamp: 1000 });
    await repo.addInteraction({ sessionId: SESSION, participantName: 'Alice', type: 'hand_raise', timestamp: 5000 });

    const results = await repo.aggregateByParticipant(SESSION);
    expect(results.find((r) => r.participantName === 'Alice')!.handRaiseCount).toBe(2);
  });

  it('computes speaking duration from start/end pairs', async () => {
    // Alice speaks for 5 seconds, then 3 seconds
    await repo.addInteraction({ sessionId: SESSION, participantName: 'Alice', type: 'speaking_start', timestamp: 1000 });
    await repo.addInteraction({ sessionId: SESSION, participantName: 'Alice', type: 'speaking_end', timestamp: 6000, metadata: { durationSeconds: 5 } });
    await repo.addInteraction({ sessionId: SESSION, participantName: 'Alice', type: 'speaking_start', timestamp: 10000 });
    await repo.addInteraction({ sessionId: SESSION, participantName: 'Alice', type: 'speaking_end', timestamp: 13000, metadata: { durationSeconds: 3 } });

    const results = await repo.aggregateByParticipant(SESSION);
    expect(results.find((r) => r.participantName === 'Alice')!.speakingDurationSeconds).toBe(8);
  });

  it('computes attendance duration from join/leave metadata', async () => {
    // Alice was there for 120s
    await repo.addInteraction({ sessionId: SESSION, participantName: 'Alice', type: 'join', timestamp: 1000 });
    await repo.addInteraction({ sessionId: SESSION, participantName: 'Alice', type: 'leave', timestamp: 121000, metadata: { durationSeconds: 120 } });

    const results = await repo.aggregateByParticipant(SESSION, 300);
    expect(results.find((r) => r.participantName === 'Alice')!.attendanceDurationSeconds).toBe(120);
  });

  it('falls back to session duration when no join/leave events', async () => {
    // Only a chat message, no join/leave
    await repo.addInteraction({ sessionId: SESSION, participantName: 'Alice', type: 'chat_message', timestamp: 1000 });

    const results = await repo.aggregateByParticipant(SESSION, 600);
    expect(results.find((r) => r.participantName === 'Alice')!.attendanceDurationSeconds).toBe(600);
  });

  it('handles multiple participants independently', async () => {
    for (const name of ['Alice', 'Bob', 'Charlie']) {
      await repo.addInteraction({ sessionId: SESSION, participantName: name, type: 'join', timestamp: 0 });
      await repo.addInteraction({ sessionId: SESSION, participantName: name, type: 'chat_message', timestamp: 1000 });
    }

    const results = await repo.aggregateByParticipant(SESSION, 300);
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.chatMessageCount).toBe(1);
    }
  });
});
