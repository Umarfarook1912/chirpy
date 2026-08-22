import { Users, Video, BarChart3, TrendingUp } from 'lucide-react';
import { Typography } from '../../ui/atoms/Typography';
import { StatCard } from '../../ui/molecules/StatCard';
import { EmptyState } from '../../ui/molecules/EmptyState';
import { Spinner } from '../../ui/atoms/Spinner';
import { useMeetingList } from '../../hooks/useMeetingList';
import { useOrganization } from '../../hooks/useOrganization';
import { useAuth } from '../../hooks/useAuth';
import { MEETING_STATUS } from '@chirpy/shared';
import styles from './DashboardPage.module.scss';

export function DashboardPage() {
  const { user } = useAuth();
  const { data: meetingData, isLoading: meetingsLoading } = useMeetingList({ limit: 5 });
  const { data: org } = useOrganization();

  const completedMeetings = meetingData?.meetings.filter(
    (m) => m.status === MEETING_STATUS.COMPLETED,
  ) ?? [];

  const avgScore =
    completedMeetings.length > 0
      ? Math.round(
          completedMeetings.reduce((sum, m) => sum + m.averageParticipationScore, 0) /
            completedMeetings.length,
        )
      : 0;

  if (meetingsLoading) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <Typography variant="h2">
          Welcome back, {user?.displayName ?? 'there'}
        </Typography>
        <Typography variant="bodySmall" color="secondary">
          {org?.name} · Meeting engagement overview
        </Typography>
      </div>

      <div className={styles.statsGrid}>
        <StatCard
          label="Total Meetings"
          value={meetingData?.total ?? 0}
          icon={<Video size={18} />}
        />
        <StatCard
          label="Avg. Participation Score"
          value={avgScore > 0 ? `${avgScore}%` : '—'}
          icon={<TrendingUp size={18} />}
          variant="primary"
        />
        <StatCard
          label="Organization Members"
          value={org?.memberCount ?? 0}
          icon={<Users size={18} />}
        />
        <StatCard
          label="Completed Sessions"
          value={completedMeetings.length}
          icon={<BarChart3 size={18} />}
        />
      </div>

      <section>
        <Typography variant="h3" className={styles.sectionTitle}>
          Recent Meetings
        </Typography>
        {meetingData?.meetings.length === 0 ? (
          <EmptyState
            title="No meetings yet"
            description="Install the CHIRPY Chrome extension and join a Google Meet to start tracking engagement."
            icon={<Video size={28} />}
          />
        ) : (
          <div className={styles.meetingList}>
            {meetingData?.meetings.map((meeting) => (
              <div key={meeting.id} className={styles.meetingRow}>
                <div>
                  <Typography variant="label">{meeting.title}</Typography>
                  <Typography variant="caption" color="secondary">
                    {meeting.platform.replace('_', ' ')} ·{' '}
                    {meeting.status}
                  </Typography>
                </div>
                <Typography variant="bodySmall" color="secondary">
                  {meeting.participantCount} participants
                </Typography>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
