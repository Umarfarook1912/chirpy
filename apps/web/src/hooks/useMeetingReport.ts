import { useQuery } from '@tanstack/react-query';
import { reportApi } from '../api/report.api';

export function useMeetingReport(meetingId: string | undefined) {
  return useQuery({
    queryKey: ['meeting-report', meetingId],
    queryFn: () => reportApi.getMeetingReport(meetingId!),
    enabled: Boolean(meetingId),
    staleTime: 30_000,
    retry: 1,
  });
}
