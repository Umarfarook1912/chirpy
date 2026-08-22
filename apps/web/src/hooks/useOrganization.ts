import { useQuery } from '@tanstack/react-query';
import { organizationApi } from '../api/organization.api';

export function useOrganization() {
  return useQuery({
    queryKey: ['organization'],
    queryFn: () => organizationApi.get(),
    staleTime: 60_000,
  });
}

export function useOrganizationMembers() {
  return useQuery({
    queryKey: ['organization', 'members'],
    queryFn: () => organizationApi.getMembers(),
    staleTime: 60_000,
  });
}
