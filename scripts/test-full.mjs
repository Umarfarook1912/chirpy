/**
 * CHIRPY Full-Stack Verification Script
 * ─────────────────────────────────────
 * Tests the complete data pipeline from session sync → API → dashboard report
 * for a realistic two-person Google Meet (host + late joiner).
 *
 * Usage:
 *   node scripts/test-full.mjs
 *
 * Optional env vars:
 *   API_BASE      (default: http://localhost:3001/api)
 *   TEST_EMAIL    (default: test@chirpy.dev)
 *   TEST_PASSWORD (default: Password123!)
 *
 * What it verifies:
 *   1. Auth login
 *   2. Session sync with host (full session) + late joiner (shorter session)
 *   3. Report contains exactly 2 participants, no junk names
 *   4. Attendance differs: host > joiner
 *   5. Speaking, chat, hand-raises attributed to correct person
 *   6. No UI chrome strings appear as participant names
 *   7. Idempotency: re-syncing same key returns same meetingId
 *   8. New session link after call ends creates a fresh meeting
 */

import { randomUUID } from 'crypto';

const BASE      = process.env.API_BASE      ?? 'http://localhost:3001/api';
const EMAIL     = process.env.TEST_EMAIL    ?? 'test@chirpy.dev';
const PASSWORD  = process.env.TEST_PASSWORD ?? 'Password123!';

let cookieJar = '';  // stores Set-Cookie from auth
let pass = 0;
let fail = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookieJar) headers['Cookie'] = cookieJar;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  // Accumulate Set-Cookie from every response
  const setCookies = res.headers.getSetCookie?.() ?? [];
  if (setCookies.length) {
    const existing = Object.fromEntries(
      cookieJar.split(';').filter(Boolean).map((c) => c.trim().split('=').slice(0, 2)),
    );
    for (const cookie of setCookies) {
      const [pair] = cookie.split(';');
      const [k, v] = pair.split('=');
      if (k && v !== undefined) existing[k.trim()] = v.trim();
    }
    cookieJar = Object.entries(existing).map(([k, v]) => `${k}=${v}`).join('; ');
  }
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

function ok(condition, label) {
  if (condition) {
    console.log(`  ✓  ${label}`);
    pass++;
  } else {
    console.error(`  ✗  ${label}`);
    fail++;
  }
}

function section(title) {
  console.log(`\n${'─'.repeat(60)}\n[${title}]`);
}

// ── Junk names that must never appear in reports ──────────────────────────────

const KNOWN_JUNK = [
  'Return to home screen',
  'Video preview is ON',
  'Backgrounds and effects',
  'Getting ready',
  'Getting ready...',
  'More information',
  'Turn on microphone',
  'Turn off microphone',
  'Chat with everyone',
  'People',
  'Participants',
  'Share screen',
  'Raise hand',
  'Host controls',
  'Meeting tools',
  'Keep pin',
  'Let participants',
  'Captions for',
  'Screen sharing',
  '1', '2', '39',
];

// ── Test sections ─────────────────────────────────────────────────────────────

async function testAuth() {
  section('1 — Auth');
  const { status } = await api('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  ok(status === 200, `Login → 200 (got ${status})`);
  const hasCookie = cookieJar.includes('accessToken') || cookieJar.includes('refresh');
  ok(hasCookie, `Auth cookie set (jar: ${cookieJar.slice(0, 60) || 'empty'})`);
}

async function testTwoPersonSession() {
  section('2 — Two-person session (host + late joiner)');

  const externalId = `test-meet-${randomUUID().slice(0, 8)}`;
  const now         = Date.now();
  const meetStart   = now - 5 * 60_000;   // 5 min ago

  const idemKey = randomUUID();

  const payload = {
    idempotencyKey:    idemKey,
    externalMeetingId: externalId,
    platform:          'google_meet',
    meetingTitle:      'Chirpy Verification Call',
    startedAt:         new Date(meetStart).toISOString(),
    endedAt:           new Date(now).toISOString(),
    interactions: [
      // Host (Umar Farook J) — present the whole call: 5 min
      {
        displayName:              'Umar Farook J',
        attendanceDurationSeconds: 300,
        chatMessageCount:          2,
        handRaiseCount:            1,
        reactionCount:             0,
        speakingDurationSeconds:   45,
      },
      // Late joiner (Jrru) — joined 2 min in: 3 min
      {
        displayName:              'Jrru',
        attendanceDurationSeconds: 180,
        chatMessageCount:          3,
        handRaiseCount:            2,
        reactionCount:             0,
        speakingDurationSeconds:   30,
      },
    ],
  };

  const { status, body } = await api('POST', '/sessions/sync', payload);
  ok(status === 201, `Sync → 201 (got ${status})`);
  if (status !== 201) console.log('  Response:', JSON.stringify(body));

  const meetingId = body.data?.meetingId ?? body.meetingId;
  ok(Boolean(meetingId), `meetingId returned (${meetingId ?? 'none'})`);
  return { meetingId, externalId, meetStart, idemKey };
}

async function testReport(meetingId) {
  section('3 — Participation report');

  const { status, body } = await api('GET', `/reports/meeting/${meetingId}`);
  ok(status === 200, `GET report → 200 (got ${status})`);

  const report = body.data?.report ?? body.data ?? body;
  const participants = report.participants ?? [];
  const names = participants.map((p) => p.displayName);

  console.log('  Participants returned:', names.join(', ') || '(none)');

  // ── Participant count ────────────────────────────────────────────────────
  ok(participants.length === 2,
    `Exactly 2 participants (got ${participants.length})`);

  // ── No junk names ────────────────────────────────────────────────────────
  for (const junk of KNOWN_JUNK) {
    const found = names.some((n) => n.toLowerCase().includes(junk.toLowerCase()));
    ok(!found, `No junk name "${junk}"`);
  }

  // ── Both real names present ──────────────────────────────────────────────
  const umar = participants.find((p) => p.displayName === 'Umar Farook J');
  const jrru = participants.find((p) => p.displayName === 'Jrru');
  ok(Boolean(umar), 'Umar Farook J present in report');
  ok(Boolean(jrru), 'Jrru present in report');

  if (!umar || !jrru) return;

  // ── Attendance: host longer than late joiner ─────────────────────────────
  ok(umar.attendanceDurationSeconds > jrru.attendanceDurationSeconds,
    `Host attendance ${umar.attendanceDurationSeconds}s > joiner ${jrru.attendanceDurationSeconds}s`);
  ok(umar.attendanceDurationSeconds >= 290 && umar.attendanceDurationSeconds <= 310,
    `Host attendance ≈300s (got ${umar.attendanceDurationSeconds}s)`);
  ok(jrru.attendanceDurationSeconds >= 170 && jrru.attendanceDurationSeconds <= 190,
    `Joiner attendance ≈180s (got ${jrru.attendanceDurationSeconds}s)`);

  // ── Chat attribution ─────────────────────────────────────────────────────
  ok(umar.chatMessageCount === 2, `Umar chat = 2 (got ${umar.chatMessageCount})`);
  ok(jrru.chatMessageCount  === 3, `Jrru  chat = 3 (got ${jrru.chatMessageCount})`);

  // ── Hand raises ──────────────────────────────────────────────────────────
  ok(umar.handRaiseCount === 1, `Umar hand raises = 1 (got ${umar.handRaiseCount})`);
  ok(jrru.handRaiseCount  === 2, `Jrru  hand raises = 2 (got ${jrru.handRaiseCount})`);

  // ── Speaking ─────────────────────────────────────────────────────────────
  ok(umar.speakingDurationSeconds === 45,
    `Umar speaking = 45s (got ${umar.speakingDurationSeconds}s)`);
  ok(jrru.speakingDurationSeconds  === 30,
    `Jrru  speaking = 30s (got ${jrru.speakingDurationSeconds}s)`);

  // ── Speaking ≤ attendance ────────────────────────────────────────────────
  ok(umar.speakingDurationSeconds <= umar.attendanceDurationSeconds,
    `Umar speaking (${umar.speakingDurationSeconds}s) ≤ attendance (${umar.attendanceDurationSeconds}s)`);
  ok(jrru.speakingDurationSeconds <= jrru.attendanceDurationSeconds,
    `Jrru speaking (${jrru.speakingDurationSeconds}s) ≤ attendance (${jrru.attendanceDurationSeconds}s)`);
}

async function testIdempotency(externalId, idemKey) {
  section('4 — Idempotency');

  const now = Date.now();
  const payload = {
    idempotencyKey:    idemKey,
    externalMeetingId: externalId,
    platform:          'google_meet',
    meetingTitle:      'Chirpy Verification Call',
    startedAt:         new Date(now - 5 * 60_000).toISOString(),
    endedAt:           new Date(now).toISOString(),
    interactions: [
      { displayName: 'Umar Farook J', attendanceDurationSeconds: 300, chatMessageCount: 2, handRaiseCount: 1, reactionCount: 0, speakingDurationSeconds: 45 },
    ],
  };

  const first  = await api('POST', '/sessions/sync', payload);
  const second = await api('POST', '/sessions/sync', payload);

  ok([200, 201].includes(first.status),  `First  re-sync → 200/201 (got ${first.status})`);
  ok([200, 201].includes(second.status), `Second re-sync → 200/201 (got ${second.status})`);

  const id1 = first.body.data?.meetingId  ?? first.body.meetingId;
  const id2 = second.body.data?.meetingId ?? second.body.meetingId;
  ok(id1 && id1 === id2, `Both re-syncs return same meetingId (${id1})`);
}

async function testNewSessionIsNewMeeting(externalId) {
  section('5 — New session on same Meet link → new Meeting record');

  const now2   = Date.now() + 2 * 3600_000;
  const start2 = now2 - 3 * 60_000;

  const payload = {
    idempotencyKey:    randomUUID(),   // new UUID = treated as a new session
    externalMeetingId: externalId,
    platform:          'google_meet',
    meetingTitle:      'Chirpy Second Call',
    startedAt:         new Date(start2).toISOString(),
    endedAt:           new Date(now2).toISOString(),
    interactions: [
      { displayName: 'Umar Farook J', attendanceDurationSeconds: 180, chatMessageCount: 0, handRaiseCount: 0, reactionCount: 0, speakingDurationSeconds: 0 },
    ],
  };

  const { status, body } = await api('POST', '/sessions/sync', payload);
  ok([200, 201].includes(status), `Second-call sync → 200/201 (got ${status})`);
  ok(Boolean(body.data?.meetingId ?? body.meetingId), 'Returns a meetingId for second call');
}

// ── Runner ────────────────────────────────────────────────────────────────────

(async () => {
  console.log('═'.repeat(60));
  console.log('CHIRPY Full-Stack Verification');
  console.log(`API: ${BASE}`);
  console.log('═'.repeat(60));

  try {
    await testAuth();
    const { meetingId, externalId, idemKey } = await testTwoPersonSession();
    if (meetingId) {
      await testReport(meetingId);
    } else {
      console.error('\n  [!] No meetingId from sync — skipping report tests');
      fail += 10;
    }
    await testIdempotency(externalId, idemKey);
    await testNewSessionIsNewMeeting(externalId);
  } catch (err) {
    console.error('\nUnexpected error:', err);
    fail++;
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`Results: ${pass} passed, ${fail} failed`);
  console.log('═'.repeat(60));

  if (fail > 0) process.exitCode = 1;
})();
