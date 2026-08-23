import { Schema, model, type Document } from 'mongoose';
import type { SyncStatus } from '@chirpy/shared';

export interface SessionDocument extends Document {
  meetingId: Schema.Types.ObjectId;
  organizationId: Schema.Types.ObjectId;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  syncStatus: SyncStatus;
  syncedAt?: Date;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<SessionDocument>(
  {
    meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    durationSeconds: { type: Number, required: true, min: 0 },
    syncStatus: {
      type: String,
      enum: ['pending', 'syncing', 'synced', 'failed'],
      default: 'synced',
    },
    syncedAt: { type: Date },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

SessionSchema.index({ meetingId: 1 });
SessionSchema.index({ organizationId: 1, createdAt: -1 });

export const SessionModel = model<SessionDocument>('Session', SessionSchema);
