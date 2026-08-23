import type { SessionSyncInput } from '@chirpy/shared';
import { InteractionRepository } from '../db/InteractionRepository';
import { SyncQueueRepository } from '../db/SyncQueueRepository';
import { generateIdempotencyKey } from '../utils/idempotency.utils';
import { getMeetingSession, removeMeetingSession, saveMeetingSession } from './MeetingSessionStore';
import { SyncService, getCachedMeetingId, syncSessionPayload, lookupMeetingIdByExternal } from './SyncService';
import { isIdempotencySynced, markIdempotencySynced, markSessionFinished } from './SyncedSessionStore';
import { writeDebugLog } from '../utils/debugLog';
import type { MeetingInfo } from '../types/extension.types';

const interactionRepo = new InteractionRepository();
const syncQueueRepo = new SyncQueueRepository();
const syncService = new SyncService();

export async function enqueueAndSyncSession(
  sessionId: string,
  meetingFallback?: MeetingInfo,
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

  const aggregated = await interactionRepo.aggregateByParticipant(sessionId, durationSeconds);
  const rawEvents = await interactionRepo.getBySession(sessionId);
  const totalChatMessages = rawEvents.filter((e) => e.type === 'chat_message').length;
  const meetingTitle = stored.meeting.title;
  const externalId = stored.meeting.externalMeetingId;

  let interactions = mergeParticipants(
    aggregated
      .filter((p) => isRealParticipant(p.participantName, meetingTitle, externalId))
      .map((p) => ({
        displayName: p.participantName,
        attendanceDurationSeconds: p.attendanceDurationSeconds || durationSeconds,
        chatMessageCount: p.chatMessageCount,
        handRaiseCount: p.handRaiseCount,
        reactionCount: p.reactionCount,
        speakingDurationSeconds: p.speakingDurationSeconds,
      })),
  );

  if (interactions.length === 0) {
    interactions = [
      {
        displayName: 'You',
        attendanceDurationSeconds: durationSeconds,
        chatMessageCount: totalChatMessages,
        handRaiseCount: 0,
        reactionCount: 0,
        speakingDurationSeconds: 0,
      },
    ];
  } else if (totalChatMessages > 0) {
    const syncedChat = interactions.reduce((sum, p) => sum + p.chatMessageCount, 0);
    if (syncedChat < totalChatMessages && interactions.length === 1) {
      interactions[0]!.chatMessageCount = totalChatMessages;
    }
  }

  const idempotencyKey = generateIdempotencyKey(
    stored.meeting.externalMeetingId,
    stored.meeting.startedAt,
  );

  const cached = await getCachedMeetingId(stored.meeting.externalMeetingId);

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

  writeDebugLog(
    'SessionSyncOrchestrator.ts:enqueueAndSyncSession',
    'sync payload',
    {
      participantCount: interactions.length,
      chatTotal: interactions.reduce((sum, i) => sum + i.chatMessageCount, 0),
      names: interactions.map((i) => i.displayName),
    },
    'H-chat',
  );

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
  const trimmed = name.trim();
  if (!trimmed || trimmed === 'Unknown') return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (trimmed.length < 2) return false;
  if (trimmed === meetingTitle) return false;
  if (trimmed.includes(externalId)) return false;
  if (/^Meet\b/i.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length > 5) return false;
  if (/^(mic|videocam|more_vert|keyboard_arrow|people|person|group)/i.test(trimmed)) return false;
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

function mergeParticipants(participants: ParticipantPayload[]): ParticipantPayload[] {
  const merged = new Map<string, ParticipantPayload>();

  for (const p of participants) {
    const key = p.displayName.toLowerCase();
    const existing = merged.get(key);
    if (existing) {
      existing.chatMessageCount += p.chatMessageCount;
      existing.handRaiseCount += p.handRaiseCount;
      existing.reactionCount += p.reactionCount;
      existing.speakingDurationSeconds += p.speakingDurationSeconds;
      existing.attendanceDurationSeconds = Math.max(
        existing.attendanceDurationSeconds,
        p.attendanceDurationSeconds,
      );
    } else {
      merged.set(key, { ...p });
    }
  }

  const you = merged.get('you');
  if (you && merged.size >= 2) {
    const others = Array.from(merged.entries()).filter(([k]) => k !== 'you');
    if (others.length === 1) {
      const [, other] = others[0]!;
      other.chatMessageCount += you.chatMessageCount;
      other.handRaiseCount += you.handRaiseCount;
      other.speakingDurationSeconds += you.speakingDurationSeconds;
      other.attendanceDurationSeconds = Math.max(other.attendanceDurationSeconds, you.attendanceDurationSeconds);
      merged.delete('you');
    }
  }

  return Array.from(merged.values());
}
