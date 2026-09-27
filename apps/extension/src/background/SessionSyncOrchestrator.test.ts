import { describe, expect, it } from 'vitest';
import { mergeParticipants } from '../background/SessionSyncOrchestrator';

describe('mergeParticipants', () => {
  it('folds You into the known self name only', () => {
    const result = mergeParticipants(
      [
        {
          displayName: 'You',
          attendanceDurationSeconds: 120,
          chatMessageCount: 2,
          handRaiseCount: 0,
          reactionCount: 0,
          speakingDurationSeconds: 40,
        },
        {
          displayName: 'Jrru',
          attendanceDurationSeconds: 40,
          chatMessageCount: 1,
          handRaiseCount: 1,
          reactionCount: 0,
          speakingDurationSeconds: 10,
        },
        {
          displayName: 'Umar Farook J',
          attendanceDurationSeconds: 0,
          chatMessageCount: 0,
          handRaiseCount: 0,
          reactionCount: 0,
          speakingDurationSeconds: 0,
        },
      ],
      'Umar Farook J',
    );

    const umar = result.find((p) => p.displayName === 'Umar Farook J');
    const jrru = result.find((p) => p.displayName === 'Jrru');
    expect(result.some((p) => /^you$/i.test(p.displayName))).toBe(false);
    expect(umar?.chatMessageCount).toBe(2);
    expect(umar?.speakingDurationSeconds).toBe(40);
    expect(umar?.attendanceDurationSeconds).toBe(120);
    expect(jrru?.chatMessageCount).toBe(1);
    expect(jrru?.handRaiseCount).toBe(1);
  });

  it('does not merge You into the highest-activity peer', () => {
    const result = mergeParticipants(
      [
        {
          displayName: 'You',
          attendanceDurationSeconds: 60,
          chatMessageCount: 2,
          handRaiseCount: 0,
          reactionCount: 0,
          speakingDurationSeconds: 30,
        },
        {
          displayName: 'Jrru',
          attendanceDurationSeconds: 40,
          chatMessageCount: 5,
          handRaiseCount: 3,
          reactionCount: 0,
          speakingDurationSeconds: 90,
        },
      ],
      'Umar Farook J',
    );

    const umar = result.find((p) => p.displayName === 'Umar Farook J');
    const jrru = result.find((p) => p.displayName === 'Jrru');
    expect(umar?.chatMessageCount).toBe(2);
    expect(umar?.speakingDurationSeconds).toBe(30);
    expect(jrru?.chatMessageCount).toBe(5);
    expect(jrru?.speakingDurationSeconds).toBe(90);
  });
});
