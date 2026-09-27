import { describe, expect, it, beforeEach } from 'vitest';
import { InteractionRepository, sumAttendanceSegments } from '../db/InteractionRepository';
import type { LocalInteraction } from '../db/db';
import { isValidParticipantName, normalizeSelfName } from '../utils/blob.utils';

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
          toArray: async () =>
            mockInteractions.filter((r) => (r as Record<string, unknown>)[field] === value),
          delete: async () => {
            const toRemove = mockInteractions.filter(
              (r) => (r as Record<string, unknown>)[field] === value,
            );
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

describe('isValidParticipantName', () => {
  it('rejects Meet UI junk names', () => {
    expect(isValidParticipantName('More information about')).toBe(false);
    expect(isValidParticipantName('1')).toBe(false);
    expect(isValidParticipantName('Participants')).toBe(false);
    expect(isValidParticipantName('Umar Farook J')).toBe(true);
    expect(isValidParticipantName('Jrru')).toBe(true);
  });

  it('normalizeSelfName maps You to real name', () => {
    expect(normalizeSelfName('You', 'Umar Farook J')).toBe('Umar Farook J');
    expect(normalizeSelfName('Jrru', 'Umar Farook J')).toBe('Jrru');
  });
});

describe('sumAttendanceSegments', () => {
  it('sums join/leave segments and excludes gap time', () => {
    const events = [
      { type: 'join', timestamp: 0 },
      { type: 'leave', timestamp: 10_000, metadata: { durationSeconds: 10 } },
      { type: 'join', timestamp: 20_000 },
      { type: 'leave', timestamp: 30_000, metadata: { durationSeconds: 10 } },
    ];
    expect(sumAttendanceSegments(events, 30_000)).toBe(20);
  });

  it('counts open segment until session end when still present', () => {
    const events = [
      { type: 'join', timestamp: 0 },
      { type: 'leave', timestamp: 10_000, metadata: { durationSeconds: 10 } },
      { type: 'join', timestamp: 20_000 },
    ];
    expect(sumAttendanceSegments(events, 35_000)).toBe(25);
  });
});

describe('InteractionRepository.aggregateByParticipant', () => {
  it('counts chat messages correctly', async () => {
    await repo.addInteraction({
      sessionId: SESSION,
      participantName: 'Alice',
      type: 'chat_message',
      timestamp: 1000,
    });
    await repo.addInteraction({
      sessionId: SESSION,
      participantName: 'Alice',
      type: 'chat_message',
      timestamp: 2000,
    });
    await repo.addInteraction({
      sessionId: SESSION,
      participantName: 'Bob',
      type: 'chat_message',
      timestamp: 3000,
    });

    const results = await repo.aggregateByParticipant(SESSION, 10_000);
    expect(results.find((r) => r.participantName === 'Alice')!.chatMessageCount).toBe(2);
    expect(results.find((r) => r.participantName === 'Bob')!.chatMessageCount).toBe(1);
  });

  it('counts hand raises correctly', async () => {
    await repo.addInteraction({
      sessionId: SESSION,
      participantName: 'Alice',
      type: 'hand_raise',
      timestamp: 1000,
    });
    await repo.addInteraction({
      sessionId: SESSION,
      participantName: 'Alice',
      type: 'hand_raise',
      timestamp: 5000,
    });

    const results = await repo.aggregateByParticipant(SESSION, 10_000);
    expect(results.find((r) => r.participantName === 'Alice')!.handRaiseCount).toBe(2);
  });

  it('computes speaking duration from start/end pairs', async () => {
    await repo.addInteraction({
      sessionId: SESSION,
      participantName: 'Alice',
      type: 'speaking_start',
      timestamp: 1000,
    });
    await repo.addInteraction({
      sessionId: SESSION,
      participantName: 'Alice',
      type: 'speaking_end',
      timestamp: 6000,
      metadata: { durationSeconds: 5 },
    });
    await repo.addInteraction({
      sessionId: SESSION,
      participantName: 'Alice',
      type: 'speaking_start',
      timestamp: 10000,
    });
    await repo.addInteraction({
      sessionId: SESSION,
      participantName: 'Alice',
      type: 'speaking_end',
      timestamp: 13000,
      metadata: { durationSeconds: 3 },
    });

    const results = await repo.aggregateByParticipant(SESSION, 20_000);
    expect(results.find((r) => r.participantName === 'Alice')!.speakingDurationSeconds).toBe(8);
  });

  it('sums rejoin attendance without counting gap', async () => {
    await repo.addInteraction({
      sessionId: SESSION,
      participantName: 'Alice',
      type: 'join',
      timestamp: 0,
    });
    await repo.addInteraction({
      sessionId: SESSION,
      participantName: 'Alice',
      type: 'leave',
      timestamp: 10_000,
      metadata: { durationSeconds: 10 },
    });
    await repo.addInteraction({
      sessionId: SESSION,
      participantName: 'Alice',
      type: 'join',
      timestamp: 20_000,
    });
    await repo.addInteraction({
      sessionId: SESSION,
      participantName: 'Alice',
      type: 'leave',
      timestamp: 30_000,
      metadata: { durationSeconds: 10 },
    });

    const results = await repo.aggregateByParticipant(SESSION, 30_000);
    expect(results.find((r) => r.participantName === 'Alice')!.attendanceDurationSeconds).toBe(20);
  });

  it('does not invent full-session attendance from chat-only events', async () => {
    await repo.addInteraction({
      sessionId: SESSION,
      participantName: 'Alice',
      type: 'chat_message',
      timestamp: 1000,
    });

    const results = await repo.aggregateByParticipant(SESSION, 600_000);
    expect(results.find((r) => r.participantName === 'Alice')!.attendanceDurationSeconds).toBe(0);
  });
});
