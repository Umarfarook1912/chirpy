import { useQuery } from '@tanstack/react-query';
import { meetingApi } from '../api/meeting.api';

export function useMeeting(meetingId: string | undefined) {
  return useQuery({
    queryKey: ['meeting', meetingId],
    queryFn: () => meetingApi.get(meetingId!),
    enabled: Boolean(meetingId),
    staleTime: 30_000,
  });
}
