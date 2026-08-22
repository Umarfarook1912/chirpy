import { Schema, model, type Document } from 'mongoose';
import type { UserRole } from '@chirpy/shared';

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  organizationId: Schema.Types.ObjectId;
  refreshTokenHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true, trim: true, maxlength: 50 },
    avatarUrl: { type: String },
    role: {
      type: String,
      enum: ['owner', 'admin', 'manager', 'member'],
      default: 'member',
    },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    refreshTokenHash: { type: String, select: false },
  },
  { timestamps: true },
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ organizationId: 1 });

export const UserModel = model<UserDocument>('User', UserSchema);
