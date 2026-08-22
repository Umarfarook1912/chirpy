import { apiClient } from './client';
import type { Organization, OrganizationMember } from '@chirpy/shared';

export const organizationApi = {
  async get(): Promise<Organization> {
    const res = await apiClient.get<{ success: true; data: { organization: Organization } }>('/organization');
    return res.data.data.organization;
  },

  async getMembers(): Promise<OrganizationMember[]> {
    const res = await apiClient.get<{ success: true; data: { members: OrganizationMember[] } }>('/organization/members');
    return res.data.data.members;
  },

  async update(data: Partial<{ name: string; logoUrl: string }>): Promise<Organization> {
    const res = await apiClient.patch<{ success: true; data: { organization: Organization } }>('/organization', data);
    return res.data.data.organization;
  },
};
