import { apiClient } from './client';
import type {
  Meeting,
  MeetingSummary,
  CreateMeetingInput,
  UpdateMeetingInput,
  MeetingQueryInput,
} from '@chirpy/shared';

export interface MeetingListResult {
  meetings: MeetingSummary[];
  total: number;
  page: number;
  limit: number;
}

export const meetingApi = {
  async list(query?: Partial<MeetingQueryInput>): Promise<MeetingListResult> {
    const res = await apiClient.get<{ success: true; data: MeetingListResult }>('/meetings', {
      params: query,
    });
    return res.data.data;
  },

  async get(id: string): Promise<Meeting> {
    const res = await apiClient.get<{ success: true; data: { meeting: Meeting } }>(`/meetings/${id}`);
    return res.data.data.meeting;
  },

  async create(data: CreateMeetingInput): Promise<Meeting> {
    const res = await apiClient.post<{ success: true; data: { meeting: Meeting } }>('/meetings', data);
    return res.data.data.meeting;
  },

  async update(id: string, data: UpdateMeetingInput): Promise<Meeting> {
    const res = await apiClient.patch<{ success: true; data: { meeting: Meeting } }>(`/meetings/${id}`, data);
    return res.data.data.meeting;
  },
};
