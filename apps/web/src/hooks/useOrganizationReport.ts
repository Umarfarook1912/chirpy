import { useQuery } from '@tanstack/react-query';
import { reportApi } from '../api/report.api';

function getDefaultPeriod(): { periodStart: string; periodEnd: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}

export function useOrganizationReport(periodStart?: string, periodEnd?: string) {
  const defaults = getDefaultPeriod();

  return useQuery({
    queryKey: ['organization-report', periodStart ?? defaults.periodStart, periodEnd ?? defaults.periodEnd],
    queryFn: () =>
      reportApi.getOrganizationReport(
        periodStart ?? defaults.periodStart,
        periodEnd ?? defaults.periodEnd,
      ),
    staleTime: 60_000,
    retry: 1,
  });
}
