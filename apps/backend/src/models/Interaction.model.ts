import { Schema, model, type Document } from 'mongoose';

export interface InteractionDocument extends Document {
  sessionId: Schema.Types.ObjectId;
  meetingId: Schema.Types.ObjectId;
  organizationId: Schema.Types.ObjectId;
  userId?: Schema.Types.ObjectId;
  displayName: string;
  attendanceDurationSeconds: number;
  chatMessageCount: number;
  handRaiseCount: number;
  reactionCount: number;
  speakingDurationSeconds: number;
  participationScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const InteractionSchema = new Schema<InteractionDocument>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
    meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    displayName: { type: String, required: true, trim: true, maxlength: 100 },
    attendanceDurationSeconds: { type: Number, required: true, min: 0 },
    chatMessageCount: { type: Number, required: true, min: 0, default: 0 },
    handRaiseCount: { type: Number, required: true, min: 0, default: 0 },
    reactionCount: { type: Number, required: true, min: 0, default: 0 },
    speakingDurationSeconds: { type: Number, required: true, min: 0, default: 0 },
    participationScore: { type: Number, required: true, min: 0, max: 100 },
  },
  { timestamps: true },
);

InteractionSchema.index({ sessionId: 1 });
InteractionSchema.index({ meetingId: 1 });
InteractionSchema.index({ organizationId: 1, createdAt: -1 });

export const InteractionModel = model<InteractionDocument>('Interaction', InteractionSchema);
