import type { SessionSyncInput } from '@chirpy/shared';
import { InteractionRepository } from '../db/InteractionRepository';
import { SyncQueueRepository } from '../db/SyncQueueRepository';
import { generateIdempotencyKey } from '../utils/idempotency.utils';
import { getMeetingSession, removeMeetingSession, saveMeetingSession } from './MeetingSessionStore';
import { SyncService, getCachedMeetingId, syncSessionPayload, lookupMeetingIdByExternal } from './SyncService';
import { isIdempotencySynced, markIdempotencySynced, markSessionFinished } from './SyncedSessionStore';
import { isValidParticipantName, normalizeSelfName } from '../utils/blob.utils';
import type { MeetingInfo } from '../types/extension.types';

const interactionRepo = new InteractionRepository();
const syncQueueRepo = new SyncQueueRepository();
const syncService = new SyncService();

export async function enqueueAndSyncSession(
  sessionId: string,
  meetingFallback?: MeetingInfo,
  selfDisplayName?: string,
): Promise<string | undefined> {
  let stored = await getMeetingSession(sessionId);

  if (!stored && meetingFallback) {
    await saveMeetingSession({ sessionId, meeting: meetingFallback });
    stored = await getMeetingSession(sessionId);
  }

  if (!stored) return undefined;

  const endedAt = Date.now();
  const durationSeconds = Math.max(
    1,
    Math.floor((endedAt - stored.meeting.startedAt) / 1_000),
  );

  const selfName =
    selfDisplayName && isValidParticipantName(selfDisplayName) && !/^you$/i.test(selfDisplayName)
      ? selfDisplayName.trim()
      : undefined;

  const aggregated = await interactionRepo.aggregateByParticipant(sessionId, endedAt);
  const rawEvents = await interactionRepo.getBySession(sessionId);
  const totalChatMessages = rawEvents.filter((e) => e.type === 'chat_message').length;
  const meetingTitle = stored.meeting.title;
  const externalId = stored.meeting.externalMeetingId;

  let interactions = mergeParticipants(
    aggregated
      .filter((p) => isRealParticipant(p.participantName, meetingTitle, externalId))
      .map((p) => {
        const displayName = normalizeSelfName(p.participantName, selfName ?? null);
        let speaking = p.speakingDurationSeconds;
        let attendance = p.attendanceDurationSeconds;
        // Speaking cannot exceed time present in the meeting
        if (attendance > 0 && speaking > attendance) {
          speaking = attendance;
        }
        return {
          displayName,
          attendanceDurationSeconds: attendance,
          chatMessageCount: p.chatMessageCount,
          handRaiseCount: p.handRaiseCount,
          reactionCount: p.reactionCount,
          speakingDurationSeconds: speaking,
        };
      }),
    selfName,
  );

  // Only fill missing attendance for the self user who was present the whole call
  // without a join event. Never overwrite peers with full session duration.
  for (const row of interactions) {
    if (row.attendanceDurationSeconds <= 0) {
      const isSelf =
        selfName && row.displayName.toLowerCase() === selfName.toLowerCase();
      if (isSelf || /^you$/i.test(row.displayName)) {
        row.attendanceDurationSeconds = durationSeconds;
      }
    }
  }

  if (interactions.length === 0) {
    interactions = [
      {
        displayName: selfName ?? 'You',
        attendanceDurationSeconds: durationSeconds,
        chatMessageCount: totalChatMessages,
        handRaiseCount: 0,
        reactionCount: 0,
        speakingDurationSeconds: 0,
      },
    ];
  }

  const idempotencyKey = generateIdempotencyKey(
    stored.meeting.externalMeetingId,
    stored.meeting.startedAt,
  );

  const cached = await getCachedMeetingId(
    stored.meeting.externalMeetingId,
    stored.meeting.startedAt,
  );

  if (await isIdempotencySynced(idempotencyKey)) {
    await removeMeetingSession(sessionId);
    return cached ?? (await lookupMeetingIdByExternal(stored.meeting.externalMeetingId));
  }

  const payload: SessionSyncInput = {
    idempotencyKey,
    externalMeetingId: stored.meeting.externalMeetingId,
    platform: stored.meeting.platform,
    meetingTitle: stored.meeting.title,
    startedAt: new Date(stored.meeting.startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    interactions,
  };

  const meetingId = await syncSessionPayload(payload);
  if (meetingId) {
    await markIdempotencySynced(idempotencyKey);
    await markSessionFinished(sessionId);
    await removeMeetingSession(sessionId);
    return meetingId;
  }

  const existing = await syncQueueRepo.getByIdempotencyKey(payload.idempotencyKey);
  if (!existing) {
    await syncQueueRepo.enqueue({
      idempotencyKey: payload.idempotencyKey,
      payload: JSON.stringify(payload),
      status: 'pending',
      retryCount: 0,
      createdAt: Date.now(),
    });
  }

  await removeMeetingSession(sessionId);

  const queuedMeetingId = await syncService.processPendingItems();
  return queuedMeetingId ?? cached ?? (await lookupMeetingIdByExternal(stored.meeting.externalMeetingId));
}

function isRealParticipant(name: string, meetingTitle: string, externalId: string): boolean {
  if (!isValidParticipantName(name)) return false;
  const trimmed = name.trim();
  if (trimmed === meetingTitle) return false;
  if (trimmed.includes(externalId)) return false;
  return true;
}

type ParticipantPayload = {
  displayName: string;
  attendanceDurationSeconds: number;
  chatMessageCount: number;
  handRaiseCount: number;
  reactionCount: number;
  speakingDurationSeconds: number;
};

/**
 * Merge duplicate name keys. "You" is ONLY folded into the known self display name —
 * never into another peer (that previously stole host chat/speaking into Jrru).
 */
export function mergeParticipants(
  participants: ParticipantPayload[],
  selfDisplayName?: string,
): ParticipantPayload[] {
  const merged = new Map<string, ParticipantPayload>();

  const fold = (into: ParticipantPayload, from: ParticipantPayload) => {
    into.chatMessageCount += from.chatMessageCount;
    into.handRaiseCount += from.handRaiseCount;
    into.reactionCount += from.reactionCount;
    into.speakingDurationSeconds += from.speakingDurationSeconds;
    into.attendanceDurationSeconds = Math.max(
      into.attendanceDurationSeconds,
      from.attendanceDurationSeconds,
    );
  };

  for (const p of participants) {
    const displayName = normalizeSelfName(p.displayName, selfDisplayName ?? null);
    const key = displayName.toLowerCase();
    const existing = merged.get(key);
    if (existing) {
      fold(existing, { ...p, displayName });
    } else {
      merged.set(key, { ...p, displayName });
    }
  }

  const you = merged.get('you');
  if (you && selfDisplayName) {
    const selfKey = selfDisplayName.toLowerCase();
    const selfRow = merged.get(selfKey);
    if (selfRow) {
      fold(selfRow, you);
      merged.delete('you');
    } else {
      // Rename You → real self name (do not merge into peers)
      merged.delete('you');
      merged.set(selfKey, { ...you, displayName: selfDisplayName });
    }
  }

  return Array.from(merged.values()).filter((p) => isValidParticipantName(p.displayName));
}
