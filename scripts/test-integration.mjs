/**
 * CHIRPY End-to-End Integration Test Script
 * Run with: node scripts/test-integration.mjs
 *
 * Prerequisites:
 *   - Backend running on http://localhost:3001
 *   - A registered user account (set TEST_EMAIL / TEST_PASSWORD env vars)
 *
 * This script verifies every back-end API endpoint used by the extension and
 * web app so you can confirm the full data pipeline without needing a real Meet.
 */

import { randomUUID } from 'crypto';

const BASE = process.env.API_BASE ?? 'http://localhost:3001/api';
const EMAIL = process.env.TEST_EMAIL ?? 'test@chirpy.dev';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Password123!';

let authToken = '';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✓ PASS: ${message}`);
  }
}

// ── Test cases ────────────────────────────────────────────────────────────────

async function testAuth() {
  console.log('\n[1] Auth flow');

  // Login
  const { status, body } = await request('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  assert(status === 200, `Login succeeds (got ${status})`);
  authToken = body.data?.token ?? body.token ?? '';
  assert(authToken.length > 10, 'Token received');
}

async function testSyncSession(meetingId) {
  console.log('\n[2] Session sync – full payload with all interaction types');

  const externalId = `test-meet-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  const payload = {
    idempotencyKey: `${externalId}-${now}`,
    externalMeetingId: externalId,
    platform: 'google_meet',
    meetingTitle: 'Integration Test Meeting',
    startedAt: new Date(now - 600_000).toISOString(),   // 10 min ago
    endedAt: new Date(now).toISOString(),
    interactions: [
      {
        displayName: 'Alice',
        attendanceDurationSeconds: 600,
        chatMessageCount: 5,
        handRaiseCount: 2,
        reactionCount: 0,
        speakingDurationSeconds: 120,
      },
      {
        displayName: 'Bob',
        attendanceDurationSeconds: 300,
        chatMessageCount: 1,
        handRaiseCount: 0,
        reactionCount: 1,
        speakingDurationSeconds: 45,
      },
    ],
  };

  const { status, body } = await request('POST', '/sessions/sync', payload);
  assert(status === 201, `Sync returns 201 (got ${status})`);
  assert(body.data?.meetingId || body.meetingId, 'meetingId returned');
  return body.data?.meetingId ?? body.meetingId;
}

async function testGetMeeting(meetingId) {
  console.log('\n[3] Meeting lookup');
  const { status, body } = await request('GET', `/meetings/${meetingId}`);
  assert(status === 200, `GET /meetings/:id returns 200 (got ${status})`);
  assert(body.data?.title === 'Integration Test Meeting', 'Title matches');
}

async function testMeetingReport(meetingId) {
  console.log('\n[4] Participation report');
  const { status, body } = await request('GET', `/reports/meeting/${meetingId}`);
  assert(status === 200, `GET /reports/meeting/:id returns 200 (got ${status})`);

  const report = body.data ?? body;
  assert(report.totalParticipants === 2, `2 participants in report (got ${report.totalParticipants})`);

  const alice = report.participants?.find((p) => p.displayName === 'Alice');
  const bob   = report.participants?.find((p) => p.displayName === 'Bob');

  assert(alice, 'Alice in participants');
  assert(bob,   'Bob in participants');

  if (alice) {
    assert(alice.chatMessageCount === 5,          `Alice chatCount=5 (got ${alice.chatMessageCount})`);
    assert(alice.handRaiseCount === 2,            `Alice handRaises=2 (got ${alice.handRaiseCount})`);
    assert(alice.speakingDurationSeconds === 120, `Alice speaking=120s (got ${alice.speakingDurationSeconds})`);
    assert(alice.attendanceDurationSeconds === 600, `Alice attendance=600s (got ${alice.attendanceDurationSeconds})`);
  }
  if (bob) {
    assert(bob.chatMessageCount === 1,          `Bob chatCount=1 (got ${bob.chatMessageCount})`);
    assert(bob.speakingDurationSeconds === 45,  `Bob speaking=45s (got ${bob.speakingDurationSeconds})`);
  }
}

async function testIdempotency(firstMeetingId) {
  console.log('\n[5] Idempotency – re-sending same key must not create duplicate');
  const now = Date.now();
  const externalId = `idempotent-${randomUUID().slice(0, 8)}`;
  const key = `${externalId}-${now}`;
  const payload = {
    idempotencyKey: key,
    externalMeetingId: externalId,
    platform: 'google_meet',
    meetingTitle: 'Idempotency Test',
    startedAt: new Date(now - 60_000).toISOString(),
    endedAt: new Date(now).toISOString(),
    interactions: [{ displayName: 'Tester', attendanceDurationSeconds: 60, chatMessageCount: 0, handRaiseCount: 0, reactionCount: 0, speakingDurationSeconds: 0 }],
  };

  const first  = await request('POST', '/sessions/sync', payload);
  const second = await request('POST', '/sessions/sync', payload);

  assert(first.status === 201,  `First sync → 201 (got ${first.status})`);
  assert(second.status === 200 || second.status === 201, `Second sync → 200 or 201 (got ${second.status})`);
  assert(first.body.data?.meetingId === second.body.data?.meetingId, 'Both return same meetingId');
}

// ── Runner ────────────────────────────────────────────────────────────────────

(async () => {
  console.log('=== CHIRPY Integration Tests ===');
  try {
    await testAuth();
    const meetingId = await testSyncSession();
    await testGetMeeting(meetingId);
    await testMeetingReport(meetingId);
    await testIdempotency(meetingId);
    console.log('\n=== Done ===');
    if (process.exitCode !== 1) console.log('All tests passed ✓');
  } catch (err) {
    console.error('\nUnexpected error:', err);
    process.exitCode = 1;
  }
})();
