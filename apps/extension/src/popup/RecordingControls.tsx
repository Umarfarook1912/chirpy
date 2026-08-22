import { useState, useCallback } from 'react';
import { RecordingService } from '../recording/RecordingService';
import { formatElapsedSeconds } from '../utils/format.utils';
import type { RecordingStatus } from '@chirpy/shared';
import { RECORDING_STATUS } from '@chirpy/shared';
import styles from './RecordingControls.module.css';

export function RecordingControls() {
  const [status, setStatus] = useState<RecordingStatus>(RECORDING_STATUS.IDLE);
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [service] = useState(
    () =>
      new RecordingService(
        (newStatus, error) => {
          setStatus(newStatus);
          if (error) setErrorMessage(error);
          if (newStatus === RECORDING_STATUS.IDLE) {
            setElapsed(0);
            setErrorMessage(null);
          }
        },
        (seconds) => setElapsed(seconds),
        'meeting',
      ),
  );

  const handleStart = useCallback(() => {
    setErrorMessage(null);
    void service.start();
  }, [service]);

  const handleStop = useCallback(() => {
    void service.stop();
  }, [service]);

  const handleReset = useCallback(() => {
    service.reset();
  }, [service]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <StatusDot status={status} />
        <span className={styles.statusLabel}>{getStatusLabel(status)}</span>
        {status === RECORDING_STATUS.RECORDING && (
          <span className={styles.timer}>{formatElapsedSeconds(elapsed)}</span>
        )}
      </div>

      {errorMessage && (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      )}

      <div className={styles.actions}>
        {status === RECORDING_STATUS.IDLE && (
          <button className={styles.startButton} onClick={handleStart} type="button">
            Start Recording
          </button>
        )}
        {status === RECORDING_STATUS.RECORDING && (
          <button className={styles.stopButton} onClick={handleStop} type="button">
            Stop Recording
          </button>
        )}
        {(status === RECORDING_STATUS.REQUESTING || status === RECORDING_STATUS.STOPPING) && (
          <button className={styles.disabledButton} disabled type="button">
            <span className={styles.spinner} />
            {status === RECORDING_STATUS.REQUESTING ? 'Waiting for permission...' : 'Stopping...'}
          </button>
        )}
        {(status === RECORDING_STATUS.COMPLETED || status === RECORDING_STATUS.ERROR) && (
          <button className={styles.resetButton} onClick={handleReset} type="button">
            {status === RECORDING_STATUS.COMPLETED ? 'New Recording' : 'Try Again'}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: RecordingStatus }) {
  const className = [
    styles.dot,
    status === RECORDING_STATUS.RECORDING ? styles.dotRecording : '',
    status === RECORDING_STATUS.COMPLETED ? styles.dotCompleted : '',
    status === RECORDING_STATUS.ERROR ? styles.dotError : '',
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={className} aria-hidden="true" />;
}

function getStatusLabel(status: RecordingStatus): string {
  const labels: Record<RecordingStatus, string> = {
    idle: 'Ready to record',
    requesting: 'Requesting permission',
    recording: 'Recording',
    stopping: 'Stopping',
    completed: 'Recording saved',
    error: 'Recording failed',
  };
  return labels[status];
}
