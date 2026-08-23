import { Schema, model, type Document } from 'mongoose';

export interface OrganizationDocument extends Document {
  name: string;
  slug: string;
  logoUrl?: string;
  ownerId?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<OrganizationDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logoUrl: { type: String },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);


export const OrganizationModel = model<OrganizationDocument>('Organization', OrganizationSchema);
