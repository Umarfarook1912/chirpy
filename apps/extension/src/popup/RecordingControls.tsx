import { useState, useCallback, useEffect } from 'react';
import { formatElapsedSeconds } from '../utils/format.utils';
import type { RecordingStatus } from '@chirpy/shared';
import { RECORDING_STATUS } from '@chirpy/shared';
import type { ActiveRecordingState } from '../types/extension.types';
import styles from './RecordingControls.module.css';

export function RecordingControls() {
  const [status, setStatus] = useState<RecordingStatus>(RECORDING_STATUS.IDLE);
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  const refreshState = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'RECORDING_GET_STATE' });
    const state = response?.state as ActiveRecordingState | null | undefined;
    if (state) {
      setStatus(state.status);
      setElapsed(state.elapsedSeconds);
      setErrorMessage(state.errorMessage ?? null);
      setActiveTabId(state.tabId);
    } else {
      setStatus(RECORDING_STATUS.IDLE);
      setElapsed(0);
      setErrorMessage(null);
      setActiveTabId(null);
    }
  }, []);

  useEffect(() => {
    void refreshState();
    const intervalId = window.setInterval(() => {
      void refreshState();
    }, 1_000);
    return () => window.clearInterval(intervalId);
  }, [refreshState]);

  const handleStart = useCallback(async () => {
    setErrorMessage(null);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.includes('meet.google.com')) {
      setErrorMessage('Open a Google Meet call in this tab before recording.');
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: 'RECORDING_START',
      payload: { tabId: tab.id },
    });

    if (!response?.success) {
      setErrorMessage(response?.error ?? 'Failed to start recording');
      return;
    }

    window.close();
  }, []);

  const handleStop = useCallback(async () => {
    await chrome.runtime.sendMessage({
      type: 'RECORDING_STOP',
      payload: { syncSession: true },
    });
    await refreshState();
  }, [refreshState]);

  const isRecording =
    status === RECORDING_STATUS.RECORDING || status === RECORDING_STATUS.REQUESTING;

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

      {isRecording && (
        <p className={styles.hint}>
          Recording runs on the Meet page. Use the Stop button overlay or below to finish and sync.
        </p>
      )}

      <div className={styles.actions}>
        {status === RECORDING_STATUS.IDLE && (
          <button className={styles.startButton} onClick={() => void handleStart()} type="button">
            Start Recording
          </button>
        )}
        {isRecording && (
          <button className={styles.stopButton} onClick={() => void handleStop()} type="button">
            Stop Recording
          </button>
        )}
        {(status === RECORDING_STATUS.STOPPING) && (
          <button className={styles.disabledButton} disabled type="button">
            <span className={styles.spinner} />
            Stopping...
          </button>
        )}
        {(status === RECORDING_STATUS.COMPLETED || status === RECORDING_STATUS.ERROR) && (
          <button
            className={styles.resetButton}
            onClick={() => void refreshState()}
            type="button"
          >
            {status === RECORDING_STATUS.COMPLETED ? 'Done' : 'Try Again'}
          </button>
        )}
      </div>

      {activeTabId !== null && isRecording && (
        <p className={styles.hint}>Popup can be closed — recording continues on Meet.</p>
      )}
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
    requesting: 'Waiting for screen share…',
    recording: 'Recording on Meet',
    stopping: 'Stopping',
    completed: 'Recording saved',
    error: 'Recording failed',
  };
  return labels[status];
}
