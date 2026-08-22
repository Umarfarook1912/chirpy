import { Schema, model, type Document } from 'mongoose';
import type { MeetingStatus, MeetingPlatform } from '@chirpy/shared';

export interface MeetingDocument extends Document {
  organizationId: Schema.Types.ObjectId;
  title: string;
  description?: string;
  platform: MeetingPlatform;
  externalMeetingId?: string;
  status: MeetingStatus;
  scheduledAt?: Date;
  startedAt?: Date;
  endedAt?: Date;
  hostId: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MeetingSchema = new Schema<MeetingDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    platform: {
      type: String,
      enum: ['google_meet', 'teams', 'zoom', 'other'],
      default: 'google_meet',
    },
    externalMeetingId: { type: String, maxlength: 200 },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    endedAt: { type: Date },
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

MeetingSchema.index({ organizationId: 1, status: 1 });
MeetingSchema.index({ organizationId: 1, createdAt: -1 });
MeetingSchema.index({ externalMeetingId: 1, organizationId: 1 });

export const MeetingModel = model<MeetingDocument>('Meeting', MeetingSchema);
