import { describe, expect, it } from 'vitest';
import {
  collectParticipantsFromSignals,
  finalizeParticipantStats,
  parseMeetParticipantLabel,
  parseRaisedHandList,
  preferRealName,
} from './participantDetect.utils';
import { isValidParticipantName } from './blob.utils';
import { mergeParticipants } from '../background/SessionSyncOrchestrator';
import { sumAttendanceSegments, sumSpeakingSeconds } from '../db/InteractionRepository';

// ─── Name validation ──────────────────────────────────────────────────────────

describe('isValidParticipantName – real names pass', () => {
  it('accepts typical meeting participant names', () => {
    expect(isValidParticipantName('Umar Farook J')).toBe(true);
    expect(isValidParticipantName('Jrru')).toBe(true);
    expect(isValidParticipantName('Alice')).toBe(true);
    expect(isValidParticipantName('Bob Smith')).toBe(true);
  });
});

describe('isValidParticipantName – Meet UI strings are rejected', () => {
  const junk = [
    'Return to home screen',
    'Video preview is ON',
    'Backgrounds and effects',
    'Getting ready...',
    // Doubled names from textContent on composite DOM elements
    'Umar Farook JUmar Farook J',
    'JmuJrru',
    'JrruJrru',
    'More information about Jrru',
    'Participants',
    'People',
    'Keep pin',
    'Share screen',
    'Raise hand',
    'Chat with everyone',
    'Host controls',
    'Meeting tools',
    'Turn off microphone',
    'Let participants share their screen',
    '1',
    '39',
    'mic',
    'videocam',
    'front_hand',
    'Getting ready',
    'Background and effects',
    'Captions for this meeting',
    'full screen',
    'change layout',
    'Screen sharing is ON',
  ];

  for (const name of junk) {
    it(`rejects "${name}"`, () => {
      expect(isValidParticipantName(name)).toBe(false);
    });
  }
});

// ─── Label parsing ────────────────────────────────────────────────────────────

describe('parseMeetParticipantLabel', () => {
  it('parses host self label', () => {
    expect(parseMeetParticipantLabel('Umar Farook J (you)')).toEqual({
      displayName: 'Umar Farook J',
      isSelf: true,
    });
  });

  it('parses peer muted label', () => {
    expect(parseMeetParticipantLabel('Jrru, muted')).toEqual({
      displayName: 'Jrru',
      isSelf: false,
    });
  });

  it('parses speaking label', () => {
    expect(parseMeetParticipantLabel('Jrru is speaking')).toEqual({
      displayName: 'Jrru',
      isSelf: false,
    });
  });

  it('rejects Meet chrome labels', () => {
    expect(parseMeetParticipantLabel('Turn on microphone')).toBeNull();
    expect(parseMeetParticipantLabel('Chat with everyone')).toBeNull();
    expect(parseMeetParticipantLabel('More information about Jrru')).toBeNull();
    expect(parseMeetParticipantLabel('Return to home screen')).toBeNull();
    expect(parseMeetParticipantLabel('Video preview is ON')).toBeNull();
    expect(parseMeetParticipantLabel('Backgrounds and effects')).toBeNull();
    expect(parseMeetParticipantLabel('Getting ready...')).toBeNull();
  });
});

// ─── Two-person Meet simulation ───────────────────────────────────────────────

describe('collectParticipantsFromSignals – two-person session', () => {
  it('returns exactly 2 participants from realistic Meet signals', () => {
    // Only participant-tile aria-labels should be passed here, NOT all page aria-labels.
    // The tile ariaLabels come from [data-participant-id] and people-panel listitems.
    const people = collectParticipantsFromSignals({
      ariaLabels: [
        'Umar Farook J (you)',
        'Jrru, muted',
      ],
      overlayNames: ['Umar Farook J', 'Jrru'],
      selfNameHint: 'Umar Farook J',
    });

    expect(people).toHaveLength(2);
    const names = people.map((p) => p.displayName).sort();
    expect(names).toEqual(['Jrru', 'Umar Farook J']);
    expect(people.find((p) => p.displayName === 'Umar Farook J')?.isSelf).toBe(true);
    expect(people.find((p) => p.displayName === 'Jrru')?.isSelf).toBe(false);
  });

  it('does NOT include UI control labels even if accidentally passed', () => {
    const people = collectParticipantsFromSignals({
      ariaLabels: [
        'Umar Farook J (you)',
        'Jrru, muted',
        'Turn on microphone',
        'Chat with everyone',
        'People (2)',
        'Return to home screen',
        'Video preview is ON',
        'Backgrounds and effects',
        'Getting ready...',
        'Share screen',
        'Raise hand',
        'Host controls',
      ],
      overlayNames: ['Umar Farook J', 'Jrru'],
      selfNameHint: 'Umar Farook J',
    });

    const names = people.map((p) => p.displayName);
    expect(names).toContain('Umar Farook J');
    expect(names).toContain('Jrru');
    expect(names).not.toContain('Turn on microphone');
    expect(names).not.toContain('Chat with everyone');
    expect(names).not.toContain('People (2)');
    expect(names).not.toContain('Return to home screen');
    expect(names).not.toContain('Video preview is ON');
    expect(names).not.toContain('Backgrounds and effects');
    expect(names).not.toContain('Getting ready...');
    expect(people.length).toBeLessThanOrEqual(2);
  });
});

// ─── Attendance: host joined earlier than late peer ───────────────────────────

describe('host vs late joiner attendance', () => {
  it('host gets longer attendance than late joiner', () => {
    const hostJoin = 0;          // meeting start
    const peerJoin = 120_000;    // 2 minutes later
    const end     = 300_000;     // 5 minutes total

    const hostAtt = sumAttendanceSegments(
      [{ type: 'join', timestamp: hostJoin }],
      end,
    );
    const peerAtt = sumAttendanceSegments(
      [{ type: 'join', timestamp: peerJoin }],
      end,
    );

    expect(hostAtt).toBe(300);   // 5 min
    expect(peerAtt).toBe(180);   // 3 min
    expect(hostAtt).toBeGreaterThan(peerAtt);
  });

  it('rejoin: only present time counted, gap excluded', () => {
    const events = [
      { type: 'join',  timestamp: 0 },
      { type: 'leave', timestamp: 60_000,  metadata: { durationSeconds: 60 } },
      { type: 'join',  timestamp: 120_000 },
      { type: 'leave', timestamp: 180_000, metadata: { durationSeconds: 60 } },
    ];
    expect(sumAttendanceSegments(events, 180_000)).toBe(120);
  });
});

// ─── Speaking cap ─────────────────────────────────────────────────────────────

describe('speaking cannot exceed attendance', () => {
  it('caps overlong speaking to attendance', () => {
    const [row] = finalizeParticipantStats([
      {
        displayName: 'Jrru',
        attendanceDurationSeconds: 40,
        chatMessageCount: 1,
        handRaiseCount: 1,
        reactionCount: 0,
        speakingDurationSeconds: 168,  // impossible — longer than attendance
      },
    ]);
    expect(row!.speakingDurationSeconds).toBe(40);
    expect(row!.attendanceDurationSeconds).toBe(40);
  });
});

// ─── Speaking seconds sum ─────────────────────────────────────────────────────

describe('sumSpeakingSeconds', () => {
  it('sums precomputed speaking_end metadata', () => {
    const events = [
      { type: 'speaking_end', timestamp: 10_000, metadata: { durationSeconds: 15 } },
      { type: 'speaking_end', timestamp: 30_000, metadata: { durationSeconds: 8 }  },
    ];
    expect(sumSpeakingSeconds(events)).toBe(23);
  });
});

// ─── mergeParticipants: You → self only, never into peer ─────────────────────

describe('mergeParticipants', () => {
  it('folds "You" into host name, keeps peer separate', () => {
    const result = mergeParticipants(
      [
        {
          displayName: 'You',
          attendanceDurationSeconds: 300,
          chatMessageCount: 2,
          handRaiseCount: 1,
          reactionCount: 0,
          speakingDurationSeconds: 18,
        },
        {
          displayName: 'Jrru',
          attendanceDurationSeconds: 120,
          chatMessageCount: 1,
          handRaiseCount: 0,
          reactionCount: 0,
          speakingDurationSeconds: 5,
        },
      ],
      'Umar Farook J',
    );

    const host = result.find((p) => p.displayName === 'Umar Farook J');
    const peer = result.find((p) => p.displayName === 'Jrru');
    const you  = result.find((p) => /^you$/i.test(p.displayName));

    expect(you).toBeUndefined();                   // "You" must be renamed
    expect(host?.chatMessageCount).toBe(2);        // host's own chat
    expect(host?.handRaiseCount).toBe(1);          // host's own raise
    expect(host?.speakingDurationSeconds).toBe(18);
    expect(host?.attendanceDurationSeconds).toBe(300);
    expect(peer?.chatMessageCount).toBe(1);        // peer keeps its own stats
    expect(peer?.attendanceDurationSeconds).toBe(120);
    expect(peer?.speakingDurationSeconds).toBe(5);
  });

  it('does NOT merge "You" into the highest-activity peer', () => {
    const result = mergeParticipants(
      [
        {
          displayName: 'You',
          attendanceDurationSeconds: 60,
          chatMessageCount: 2,
          handRaiseCount: 0,
          reactionCount: 0,
          speakingDurationSeconds: 10,
        },
        {
          displayName: 'Jrru',
          attendanceDurationSeconds: 40,
          chatMessageCount: 10,
          handRaiseCount: 5,
          reactionCount: 0,
          speakingDurationSeconds: 90,
        },
      ],
      'Umar Farook J',
    );
    const host = result.find((p) => p.displayName === 'Umar Farook J');
    const peer = result.find((p) => p.displayName === 'Jrru');
    expect(host?.chatMessageCount).toBe(2);
    expect(peer?.chatMessageCount).toBe(10);  // peer's high count is unchanged
    expect(peer?.attendanceDurationSeconds).toBe(40);
  });
});

// ─── preferRealName ───────────────────────────────────────────────────────────

describe('parseRaisedHandList – strings captured from Meet', () => {
  it('reads the host from the raised-hands panel', () => {
    const people = parseRaisedHandList(
      'Raised hands1keyboard_arrow_downLower allUmar Farook J(You)Meeting hostfront_handLower',
    );
    expect(people).toEqual([{ displayName: 'Umar Farook J', isSelf: true }]);
  });

  it('reads a peer and ignores the count badge', () => {
    expect(parseRaisedHandList('1 raised hand')).toEqual([]);
    expect(
      parseRaisedHandList('Raised hands1keyboard_arrow_downLower allJrrufront_handLower'),
    ).toEqual([{ displayName: 'Jrru', isSelf: false }]);
  });

  it('reads the name on the video-tile hand badge', () => {
    expect(
      parseRaisedHandList(
        'Hand raisesUmar Farook Jfront_handPress the down arrow to open the hover tray and Escape to close it.',
      ),
    ).toEqual([{ displayName: 'Umar Farook J', isSelf: false }]);
  });

  it('reads two people in one panel', () => {
    const people = parseRaisedHandList(
      'Lower allUmar Farook J(You)Meeting hostfront_handLowerJrrufront_hand',
    );
    expect(people.map((p) => p.displayName)).toEqual(['Umar Farook J', 'Jrru']);
    expect(people[0]?.isSelf).toBe(true);
    expect(people[1]?.isSelf).toBe(false);
  });
});

describe('preferRealName', () => {
  it('skips literal "You" in favour of real name', () => {
    expect(preferRealName('You', 'Umar Farook J')).toBe('Umar Farook J');
  });
  it('falls back to "You" if no real name exists', () => {
    expect(preferRealName(null, 'You')).toBe('You');
  });
  it('skips null/undefined candidates', () => {
    expect(preferRealName(null, undefined, 'Alice')).toBe('Alice');
  });
});
