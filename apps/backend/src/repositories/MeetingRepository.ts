import { MeetingModel, type MeetingDocument } from '../models/Meeting.model';
import type { MeetingStatus, MeetingPlatform } from '@chirpy/shared';
import type { Types } from 'mongoose';

export interface MeetingFilters {
  status?: MeetingStatus;
  platform?: MeetingPlatform;
  page?: number;
  limit?: number;
}

export class MeetingRepository {
  async findById(id: string): Promise<MeetingDocument | null> {
    return MeetingModel.findById(id).exec();
  }

  async findByOrganization(
    organizationId: string,
    filters: MeetingFilters = {},
  ): Promise<{ meetings: MeetingDocument[]; total: number }> {
    const { status, platform, page = 1, limit = 20 } = filters;
    const query: Record<string, unknown> = { organizationId };
    if (status) query['status'] = status;
    if (platform) query['platform'] = platform;

    const [meetings, total] = await Promise.all([
      MeetingModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      MeetingModel.countDocuments(query).exec(),
    ]);

    return { meetings, total };
  }

  async create(data: {
    organizationId: Types.ObjectId;
    title: string;
    description?: string | undefined;
    platform: MeetingPlatform;
    externalMeetingId?: string | undefined;
    hostId: Types.ObjectId;
    scheduledAt?: Date | undefined;
  }): Promise<MeetingDocument> {
    return MeetingModel.create(data);
  }

  async update(
    id: string,
    data: Partial<MeetingDocument>,
  ): Promise<MeetingDocument | null> {
    return MeetingModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }
}
