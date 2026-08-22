import { SessionModel, type SessionDocument } from '../models/Session.model';
import { InteractionModel, type InteractionDocument } from '../models/Interaction.model';
import type { Types } from 'mongoose';

export class SessionRepository {
  async findByIdempotencyKey(key: string): Promise<SessionDocument | null> {
    return SessionModel.findOne({ idempotencyKey: key }).exec();
  }

  async findByMeeting(meetingId: string): Promise<SessionDocument[]> {
    return SessionModel.find({ meetingId }).sort({ startedAt: -1 }).exec();
  }

  async createWithInteractions(
    sessionData: {
      meetingId: Types.ObjectId;
      organizationId: Types.ObjectId;
      startedAt: Date;
      endedAt: Date;
      durationSeconds: number;
      idempotencyKey: string;
    },
    interactionsData: Array<{
      meetingId: Types.ObjectId;
      organizationId: Types.ObjectId;
      userId?: Types.ObjectId;
      displayName: string;
      attendanceDurationSeconds: number;
      chatMessageCount: number;
      handRaiseCount: number;
      reactionCount: number;
      speakingDurationSeconds: number;
      participationScore: number;
    }>,
  ): Promise<{ session: SessionDocument; interactions: InteractionDocument[] }> {
    const session = await SessionModel.create({ ...sessionData, syncStatus: 'synced', syncedAt: new Date() });

    const interactions = await InteractionModel.insertMany(
      interactionsData.map((i) => ({ ...i, sessionId: session._id })),
    );

    return { session, interactions: interactions as unknown as InteractionDocument[] };
  }
}
