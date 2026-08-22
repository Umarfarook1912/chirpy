import { Video, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Typography } from '../../ui/atoms/Typography';
import { Button } from '../../ui/atoms/Button';
import { Badge } from '../../ui/atoms/Badge';
import { Spinner } from '../../ui/atoms/Spinner';
import { EmptyState } from '../../ui/molecules/EmptyState';
import { useMeetingList } from '../../hooks/useMeetingList';
import { ROUTES } from '../../constants/routes.constants';
import { formatDate, formatDuration } from '../../utils/date.utils';
import { MEETING_STATUS_LABELS } from '@chirpy/shared';
import type { BadgeVariant } from '../../ui/atoms/Badge';
import type { MeetingStatus } from '@chirpy/shared';
import styles from './MeetingListPage.module.scss';

const STATUS_BADGE_MAP: Record<MeetingStatus, BadgeVariant> = {
  active: 'success',
  completed: 'neutral',
  scheduled: 'primary',
  cancelled: 'error',
};

export function MeetingListPage() {
  const { data, isLoading, isError } = useMeetingList();

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.page}>
        <Typography variant="body" color="error">
          Failed to load meetings. Please try again.
        </Typography>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <Typography variant="h2">Meetings</Typography>
          <Typography variant="bodySmall" color="secondary">
            {data?.total ?? 0} total meetings
          </Typography>
        </div>
        <Link to="#">
          <Button variant="primary" size="sm">
            <Plus size={16} />
            New Meeting
          </Button>
        </Link>
      </div>

      {data?.meetings.length === 0 ? (
        <EmptyState
          title="No meetings yet"
          description="Install the CHIRPY extension and join a Google Meet to automatically track your meetings."
          icon={<Video size={28} />}
        />
      ) : (
        <div className={styles.list}>
          {data?.meetings.map((meeting) => (
            <Link
              key={meeting.id}
              to={ROUTES.MEETINGS.DETAIL(meeting.id)}
              className={styles.meetingCard}
            >
              <div className={styles.meetingInfo}>
                <Typography variant="label">{meeting.title}</Typography>
                <Typography variant="caption" color="secondary">
                  {formatDate(meeting.startedAt ?? meeting.scheduledAt)} ·{' '}
                  {formatDuration(meeting.durationMinutes)} ·{' '}
                  {meeting.participantCount} participants
                </Typography>
              </div>
              <div className={styles.meetingMeta}>
                <Badge variant={STATUS_BADGE_MAP[meeting.status]}>
                  {MEETING_STATUS_LABELS[meeting.status]}
                </Badge>
                {meeting.averageParticipationScore > 0 && (
                  <Typography variant="bodySmall" color="secondary">
                    {meeting.averageParticipationScore}% avg
                  </Typography>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
