import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Film, MessageSquare, Mic, Users } from 'lucide-react';
import { Typography } from '../../ui/atoms/Typography';
import { Button } from '../../ui/atoms/Button';
import { Badge } from '../../ui/atoms/Badge';
import { Spinner } from '../../ui/atoms/Spinner';
import { StatCard } from '../../ui/molecules/StatCard';
import { useMeeting } from '../../hooks/useMeeting';
import { useMeetingReport } from '../../hooks/useMeetingReport';
import { ROUTES } from '../../constants/routes.constants';
import { formatDate, formatDuration, formatSeconds } from '../../utils/date.utils';
import { MEETING_STATUS_LABELS } from '@chirpy/shared';
import {
  downloadBlob,
  fetchRecordingFromExtension,
  fetchLatestRecordingFromExtension,
  revokeRecordingPreview,
  type ExtensionRecording,
} from '../../utils/recording.utils';
import { convertWebmToMp4, resetFfmpegCache } from '../../utils/mp4.utils';
import styles from './MeetingDetailPage.module.scss';

export function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const recordingKey = searchParams.get('recording');

  const { data: meeting, isLoading: meetingLoading, isError: meetingError } = useMeeting(id);
  const { data: report, isLoading: reportLoading, isError: reportError } = useMeetingReport(id);

  const [recording, setRecording] = useState<ExtensionRecording | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [mp4Loading, setMp4Loading] = useState(false);
  const [mp4Progress, setMp4Progress] = useState(0);
  const [mp4Label, setMp4Label] = useState('');

  const loadRecording = useCallback(async (key: string) => {
    setRecordingLoading(true);
    setRecordingError(null);
    try {
      const result = await fetchRecordingFromExtension(key);
      setRecording((prev) => {
        revokeRecordingPreview(prev);
        return result;
      });
    } catch (err) {
      setRecordingError(err instanceof Error ? err.message : 'Failed to load recording');
    } finally {
      setRecordingLoading(false);
    }
  }, []);

  useEffect(() => () => { revokeRecordingPreview(recording); }, [recording]);

  useEffect(() => {
    if (recordingKey) {
      void loadRecording(recordingKey);
      return;
    }

    void (async () => {
      setRecordingLoading(true);
      setRecordingError(null);
      try {
        const result = await fetchLatestRecordingFromExtension();
        setRecording(result);
      } catch {
        /* no recording available yet */
      } finally {
        setRecordingLoading(false);
      }
    })();
  }, [recordingKey, loadRecording]);

  const handleDownloadWebm = () => {
    if (!recording) return;
    const safeTitle = (meeting?.title ?? recording.meetingTitle).replace(/[^\w\- ]+/g, '').trim();
    downloadBlob(recording.blob, `${safeTitle || 'meeting'}.webm`);
  };

  const handleDownloadMp4 = async () => {
    if (!recording) return;
    setMp4Loading(true);
    setMp4Progress(0);
    setMp4Label('Starting conversion…');
    setRecordingError(null);
    try {
      const mp4Blob = await convertWebmToMp4(recording.blob, (p) => {
        setMp4Progress(p.percent);
        setMp4Label(p.label);
      });
      const safeTitle = (meeting?.title ?? recording.meetingTitle).replace(/[^\w\- ]+/g, '').trim();
      downloadBlob(mp4Blob, `${safeTitle || 'meeting'}.mp4`);
    } catch (err) {
      resetFfmpegCache();
      const detail = err instanceof Error ? err.message : 'Unknown error';
      setRecordingError(
        `MP4 conversion failed: ${detail}. You can still use Download WebM (plays in Chrome/Edge/VLC).`,
      );
    } finally {
      setMp4Loading(false);
      setMp4Progress(0);
      setMp4Label('');
    }
  };

  if (meetingLoading) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (meetingError || !meeting) {
    return (
      <div className={styles.page}>
        <Typography variant="body" color="error">
          Meeting not found or failed to load.
        </Typography>
        <Link to={ROUTES.MEETINGS.LIST} className={styles.backLink}>
          <ArrowLeft size={16} /> Back to meetings
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link to={ROUTES.MEETINGS.LIST} className={styles.backLink}>
        <ArrowLeft size={16} /> Back to meetings
      </Link>

      <div className={styles.header}>
        <Typography variant="h2">{meeting.title}</Typography>
        <Typography variant="bodySmall" color="secondary">
          {formatDate(meeting.startedAt ?? meeting.scheduledAt)} ·{' '}
          {formatDuration(report?.durationMinutes ?? undefined)} ·{' '}
          {meeting.platform.replace('_', ' ')}
        </Typography>
        <Badge variant={meeting.status === 'completed' ? 'neutral' : 'primary'}>
          {MEETING_STATUS_LABELS[meeting.status]}
        </Badge>
      </div>

      {reportLoading ? (
        <div className={styles.section}>
          <Typography variant="h3">Participation report</Typography>
          <Spinner size="md" />
        </div>
      ) : reportError ? (
        <div className={styles.section}>
          <Typography variant="h3">Participation report</Typography>
          <Typography variant="body" color="secondary">
            Report data is not available yet for this meeting.
          </Typography>
        </div>
      ) : report ? (
        <>
          <div className={styles.statsGrid}>
            <StatCard
              label="Participants"
              value={report.totalParticipants}
              icon={<Users size={18} />}
            />
            <StatCard
              label="Avg. Score"
              value={report.averageParticipationScore > 0 ? `${report.averageParticipationScore}%` : '—'}
              icon={<Mic size={18} />}
              variant="primary"
            />
            <StatCard
              label="Chat Messages"
              value={report.participants.reduce((sum, p) => sum + p.chatMessageCount, 0)}
              icon={<MessageSquare size={18} />}
            />
            <StatCard
              label="Duration"
              value={formatDuration(report.durationMinutes)}
              icon={<Film size={18} />}
            />
          </div>

          <section className={styles.section}>
            <Typography variant="h3">Engagement breakdown</Typography>
            <div className={styles.engagementRow}>
              <div className={styles.engagementPill}>
                <Typography variant="caption" color="secondary">High</Typography>
                <Typography variant="label">{report.highEngagementCount}</Typography>
              </div>
              <div className={styles.engagementPill}>
                <Typography variant="caption" color="secondary">Medium</Typography>
                <Typography variant="label">{report.mediumEngagementCount}</Typography>
              </div>
              <div className={styles.engagementPill}>
                <Typography variant="caption" color="secondary">Low</Typography>
                <Typography variant="label">{report.lowEngagementCount}</Typography>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <Typography variant="h3">Participants & interactions</Typography>
            {report.participants.length === 0 ? (
              <Typography variant="body" color="secondary">
                No interaction data captured for this meeting yet.
              </Typography>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Score</th>
                      <th>Chat</th>
                      <th>Hand raises</th>
                      <th>Speaking</th>
                      <th>Time in meeting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.participants.map((p) => (
                      <tr key={p.participantId}>
                        <td>{p.displayName}</td>
                        <td>{p.participationScore}%</td>
                        <td>{p.chatMessageCount}</td>
                        <td>{p.handRaiseCount}</td>
                        <td>{formatSeconds(p.speakingDurationSeconds)}</td>
                        <td>{formatSeconds(p.attendanceDurationSeconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      <section className={styles.section}>
        <Typography variant="h3">Recording</Typography>
        <div className={styles.recordingCard}>
          {recordingLoading ? (
            <Spinner size="md" />
          ) : recordingError ? (
            <Typography variant="body" color="error">{recordingError}</Typography>
          ) : recording ? (
            <>
              <video
                className={styles.videoPreview}
                src={recording.previewUrl}
                controls
                playsInline
              />
              <Typography variant="caption" color="secondary">
                WebM plays in Chrome/Edge/VLC. Use Download MP4 for Windows Media Player.
              </Typography>
              <div className={styles.actions}>
                <Button variant="secondary" size="sm" onClick={handleDownloadWebm} disabled={mp4Loading}>
                  <Download size={16} />
                  Download WebM
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleDownloadMp4()}
                  disabled={mp4Loading}
                >
                  <Download size={16} />
                  {mp4Loading ? (mp4Label || `Converting… ${mp4Progress}%`) : 'Download MP4'}
                </Button>
              </div>
              {mp4Loading && (
                <div className={styles.progressWrap} role="status" aria-live="polite">
                  <div className={styles.progressMeta}>
                    <Typography variant="caption" color="secondary">
                      {mp4Label || 'Converting…'}
                    </Typography>
                    <Typography variant="caption" color="secondary">
                      {mp4Progress}%
                    </Typography>
                  </div>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${mp4Progress}%` }} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <Typography variant="body" color="secondary">
                No recording found in the extension yet.
              </Typography>
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (recordingKey) void loadRecording(recordingKey);
                    else void fetchLatestRecordingFromExtension().then(setRecording).catch((err) => {
                      setRecordingError(err instanceof Error ? err.message : 'Could not load recording');
                    });
                  }}
                >
                  Load recording from extension
                </Button>
              </div>
              {!recordingKey && (
                <div className={styles.alert}>
                  Tip: When you stop recording in Google Meet, CHIRPY opens this page with your
                  recording ready to download.
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
