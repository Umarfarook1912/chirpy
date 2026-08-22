import { apiClient } from './client';
import type { MeetingReport, OrganizationReport } from '@chirpy/shared';

export const reportApi = {
  async getMeetingReport(meetingId: string): Promise<MeetingReport> {
    const res = await apiClient.get<{ success: true; data: { report: MeetingReport } }>(
      `/reports/meeting/${meetingId}`,
    );
    return res.data.data.report;
  },

  async getOrganizationReport(periodStart: string, periodEnd: string): Promise<OrganizationReport> {
    const res = await apiClient.get<{ success: true; data: { report: OrganizationReport } }>(
      '/reports/organization',
      { params: { periodStart, periodEnd } },
    );
    return res.data.data.report;
  },
};
