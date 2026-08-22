import { useQuery } from '@tanstack/react-query';
import { meetingApi } from '../api/meeting.api';
import type { MeetingQueryInput } from '@chirpy/shared';

export function useMeetingList(query?: Partial<MeetingQueryInput>) {
  return useQuery({
    queryKey: ['meetings', query],
    queryFn: () => meetingApi.list(query),
    staleTime: 30_000,
  });
}
