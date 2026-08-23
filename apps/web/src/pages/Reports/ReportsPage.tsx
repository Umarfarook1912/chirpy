import { Link } from 'react-router-dom';
import { BarChart3, TrendingUp, Users, Video } from 'lucide-react';
import { Typography } from '../../ui/atoms/Typography';
import { StatCard } from '../../ui/molecules/StatCard';
import { Spinner } from '../../ui/atoms/Spinner';
import { EmptyState } from '../../ui/molecules/EmptyState';
import { useOrganizationReport } from '../../hooks/useOrganizationReport';
import { ROUTES } from '../../constants/routes.constants';
import { formatDate, formatDuration } from '../../utils/date.utils';
import styles from './ReportsPage.module.scss';

export function ReportsPage() {
  const { data: report, isLoading, isError } = useOrganizationReport();

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className={styles.page}>
        <Typography variant="h2">Reports</Typography>
        <Typography variant="body" color="error">
          Failed to load organization report.
        </Typography>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Typography variant="h2">Reports</Typography>
        <Typography variant="bodySmall" color="secondary">
          Last 30 days · {formatDate(report.periodStart)} – {formatDate(report.periodEnd)}
        </Typography>
      </div>

      <div className={styles.statsGrid}>
        <StatCard label="Total Meetings" value={report.totalMeetings} icon={<Video size={18} />} />
        <StatCard
          label="Total Participants"
          value={report.totalParticipants}
          icon={<Users size={18} />}
        />
        <StatCard
          label="Avg. Participation"
          value={report.averageParticipationScore > 0 ? `${report.averageParticipationScore}%` : '—'}
          icon={<TrendingUp size={18} />}
          variant="primary"
        />
        <StatCard
          label="Meetings tracked"
          value={report.meetingSummaries.length}
          icon={<BarChart3 size={18} />}
        />
      </div>

      <section className={styles.section}>
        <Typography variant="h3">Meeting summaries</Typography>
        {report.meetingSummaries.length === 0 ? (
          <EmptyState
            title="No report data yet"
            description="Complete a tracked Google Meet session to see organization reports."
            icon={<BarChart3 size={28} />}
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Meeting</th>
                  <th>Date</th>
                  <th>Participants</th>
                  <th>Avg. score</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {report.meetingSummaries.map((summary) => (
                  <tr key={summary.meetingId}>
                    <td>
                      <Link to={ROUTES.MEETINGS.DETAIL(summary.meetingId)} className={styles.meetingLink}>
                        {summary.title}
                      </Link>
                    </td>
                    <td>{formatDate(summary.date)}</td>
                    <td>{summary.participantCount}</td>
                    <td>{summary.averageScore > 0 ? `${summary.averageScore}%` : '—'}</td>
                    <td>{formatDuration(summary.durationMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
