import type { RecordingStatus } from '@chirpy/shared';
import { formatElapsedSeconds } from '../utils/format.utils';
import { dataUrlToBlob, downloadBlobInPage } from '../utils/blob.utils';

const OVERLAY_ID = 'chirpy-recording-overlay';
const POSITION_KEY = 'chirpy:overlayPosition';

export class RecordingOverlay {
  private root: HTMLElement | null = null;
  private wrapEl: HTMLElement | null = null;
  private timerEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private stopButton: HTMLButtonElement | null = null;
  private onStop: (() => void) | null = null;
  private isStopping = false;

  mount(onStop: () => void): void {
    this.onStop = onStop;
    if (document.getElementById(OVERLAY_ID)) return;

    const root = document.createElement('div');
    root.id = OVERLAY_ID;
    root.setAttribute('data-chirpy-overlay', 'true');

    const shadow = root.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host, .wrap {
          all: initial;
          font-family: "Google Sans", Roboto, Arial, sans-serif;
        }
        .wrap {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2147483646;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(31, 23, 36, 0.92);
          color: #fff;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.28);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(8px);
          cursor: grab;
          user-select: none;
          touch-action: none;
        }
        .wrap.dragging { cursor: grabbing; }
        .wrap:has(.actions) { cursor: default; }
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ef4444;
          flex-shrink: 0;
          animation: pulse 1.5s ease-in-out infinite;
        }
        .dot.idle { background: #6f6475; animation: none; }
        .dot.error { background: #f59e0b; animation: none; }
        .dot.completed { background: #22c55e; animation: none; }
        .info { display: flex; flex-direction: column; gap: 2px; min-width: 120px; }
        .label { font-size: 12px; font-weight: 600; letter-spacing: 0.02em; }
        .timer { font-size: 11px; color: rgba(255,255,255,0.72); font-variant-numeric: tabular-nums; }
        .stop {
          border: none;
          border-radius: 10px;
          padding: 8px 12px;
          background: #ef4444;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .stop:hover { background: #dc2626; }
        .stop:disabled { opacity: 0.6; cursor: not-allowed; }
        .actions { display: flex; flex-direction: column; gap: 6px; }
        .btn {
          border: none;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .btn-webm { background: #7c3aed; color: #fff; }
        .btn-webm:hover { background: #6d28d9; }
        .btn-mp4 { background: #2563eb; color: #fff; }
        .btn-mp4:hover { background: #1d4ed8; }
        .btn-dash { background: rgba(255,255,255,0.12); color: #fff; }
        .btn-dash:hover { background: rgba(255,255,255,0.2); }
        .hint { font-size: 10px; color: rgba(255,255,255,0.55); margin-top: 2px; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      </style>
      <div class="wrap" role="status" aria-live="polite">
        <span class="dot"></span>
        <div class="info">
          <span class="label">CHIRPY Recording</span>
          <span class="timer">00:00</span>
        </div>
        <button class="stop" type="button">Stop</button>
      </div>
    `;

    this.root = root;
    this.wrapEl = shadow.querySelector('.wrap');
    this.timerEl = shadow.querySelector('.timer');
    this.statusEl = shadow.querySelector('.label');
    this.stopButton = shadow.querySelector('.stop');

    this.restorePosition();
    this.enableDrag();

    this.stopButton?.addEventListener('click', (event) => {
      event.stopPropagation();
      if (this.isStopping) return;
      this.isStopping = true;
      if (this.stopButton) this.stopButton.disabled = true;
      if (this.statusEl) this.statusEl.textContent = 'Syncing to dashboard…';
      this.onStop?.();
    });

    document.documentElement.appendChild(root);
  }

  private restorePosition(): void {
    if (!this.wrapEl) return;
    try {
      const saved = sessionStorage.getItem(POSITION_KEY);
      if (!saved) return;
      const { x, y } = JSON.parse(saved) as { x: number; y: number };
      this.wrapEl.style.left = `${x}px`;
      this.wrapEl.style.top = `${y}px`;
      this.wrapEl.style.right = 'auto';
      this.wrapEl.style.bottom = 'auto';
    } catch {
      /* ignore */
    }
  }

  private enableDrag(): void {
    if (!this.wrapEl) return;

    let offsetX = 0;
    let offsetY = 0;

    const onPointerMove = (event: PointerEvent) => {
      if (!this.wrapEl) return;
      const x = Math.max(8, Math.min(window.innerWidth - this.wrapEl.offsetWidth - 8, event.clientX - offsetX));
      const y = Math.max(8, Math.min(window.innerHeight - this.wrapEl.offsetHeight - 8, event.clientY - offsetY));
      this.wrapEl.style.left = `${x}px`;
      this.wrapEl.style.top = `${y}px`;
      this.wrapEl.style.right = 'auto';
      this.wrapEl.style.bottom = 'auto';
    };

    const onPointerUp = (event: PointerEvent) => {
      this.wrapEl?.classList.remove('dragging');
      this.wrapEl?.releasePointerCapture(event.pointerId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (this.wrapEl) {
        sessionStorage.setItem(
          POSITION_KEY,
          JSON.stringify({
            x: parseInt(this.wrapEl.style.left, 10),
            y: parseInt(this.wrapEl.style.top, 10),
          }),
        );
      }
    };

    this.wrapEl.addEventListener('pointerdown', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('.stop, .btn, .actions, button, a')) return;
      if (!this.wrapEl) return;

      const rect = this.wrapEl.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      this.wrapEl.classList.add('dragging');
      this.wrapEl.setPointerCapture(event.pointerId);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  setStatusText(text: string): void {
    if (this.statusEl) this.statusEl.textContent = text;
  }

  clearTimer(): void {
    if (this.timerEl) this.timerEl.textContent = '';
  }

  hideStopButton(): void {
    if (this.stopButton) {
      this.stopButton.disabled = true;
      this.stopButton.style.display = 'none';
    }
  }

  update(status: RecordingStatus, elapsedSeconds: number, errorMessage?: string): void {
    if (!this.root) return;

    const dot = this.root.shadowRoot?.querySelector('.dot');
    const label = getStatusLabel(status, errorMessage);

    if (this.statusEl) this.statusEl.textContent = label;
    if (this.timerEl) {
      this.timerEl.textContent =
        status === 'recording' || status === 'stopping'
          ? formatElapsedSeconds(elapsedSeconds)
          : '';
    }

    dot?.classList.remove('idle', 'error', 'completed');
    if (status === 'recording' || status === 'requesting') {
      /* default red pulse */
    } else if (status === 'completed') {
      dot?.classList.add('completed');
    } else if (status === 'error') {
      dot?.classList.add('error');
    } else {
      dot?.classList.add('idle');
    }

    if (this.stopButton) {
      this.stopButton.disabled = status === 'stopping' || status === 'requesting' || this.isStopping;
      this.stopButton.style.display =
        status === 'recording' || status === 'requesting' || status === 'stopping'
          ? 'inline-block'
          : 'none';
    }
  }

  showDownloadPanel(options: {
    meetingId: string;
    recordingKey?: string;
    meetingTitle: string;
    hasRecording: boolean;
  }): void {
    if (!this.root?.shadowRoot) return;

    const wrap = this.root.shadowRoot.querySelector('.wrap');
    if (!wrap) return;

    this.isStopping = false;
    const dot = this.root.shadowRoot.querySelector('.dot');
    dot?.classList.remove('idle', 'error');
    dot?.classList.add('completed');

    if (this.statusEl) {
      this.statusEl.textContent = options.hasRecording
        ? 'Recording saved — download or view'
        : 'Synced — no recording saved';
    }
    if (this.timerEl) {
      this.timerEl.textContent = options.hasRecording ? 'Ready to download' : 'Open dashboard for details';
    }
    if (this.stopButton) this.stopButton.style.display = 'none';

    const existing = wrap.querySelector('.actions');
    existing?.remove();

    const actions = document.createElement('div');
    actions.className = 'actions';

    if (options.hasRecording) {
      const webmBtn = document.createElement('button');
      webmBtn.className = 'btn btn-webm';
      webmBtn.type = 'button';
      webmBtn.textContent = 'Download WebM';
      this.wireDownloadButton(webmBtn, 'DOWNLOAD_RECORDING', {
        recordingKey: options.recordingKey,
        meetingTitle: options.meetingTitle,
      }, 'Downloading…');
      actions.appendChild(webmBtn);

      const mp4Btn = document.createElement('button');
      mp4Btn.className = 'btn btn-mp4';
      mp4Btn.type = 'button';
      mp4Btn.textContent = 'Convert MP4';
      this.wireDownloadButton(mp4Btn, 'OPEN_MEETING_TAB', {
        meetingId: options.meetingId,
        recordingKey: options.recordingKey,
      }, 'Opening…');
      actions.appendChild(mp4Btn);
    }

    const dashBtn = document.createElement('button');
    dashBtn.className = 'btn btn-dash';
    dashBtn.type = 'button';
    dashBtn.textContent = 'View dashboard';
    if (options.meetingId) {
      this.wireDownloadButton(dashBtn, 'OPEN_MEETING_TAB', {
        meetingId: options.meetingId,
        recordingKey: options.recordingKey,
      }, 'Opening…');
    } else {
      dashBtn.disabled = true;
      dashBtn.title = 'Meeting not synced yet';
    }
    actions.appendChild(dashBtn);

    wrap.appendChild(actions);
  }

  private async sendExtensionMessage(
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const response = (await chrome.runtime.sendMessage({ type, payload })) as {
        success?: boolean;
        error?: string;
        dataUrl?: string;
        filename?: string;
        downloaded?: boolean;
      };
      if (response?.success && response.downloaded) {
        if (this.statusEl) this.statusEl.textContent = 'Download started — check your Downloads folder';
        return;
      }
      if (response?.success && response.dataUrl && response.filename) {
        const blob = dataUrlToBlob(response.dataUrl);
        downloadBlobInPage(blob, response.filename);
        if (this.statusEl) this.statusEl.textContent = 'Download started — open the file to play';
        return;
      }
      if (response?.success === false && response.error) {
        if (this.statusEl) this.statusEl.textContent = response.error;
        return;
      }
      if (this.statusEl) {
        this.statusEl.textContent =
          response?.error ?? 'Download failed — reload extension and try again';
      }
    } catch (err) {
      if (this.statusEl) {
        this.statusEl.textContent =
          err instanceof Error ? err.message : 'Action failed — reload extension';
      }
    }
  }

  private wireDownloadButton(
    button: HTMLButtonElement,
    type: string,
    payload: Record<string, unknown>,
    busyLabel: string,
  ): void {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      button.disabled = true;
      const original = button.textContent;
      button.textContent = busyLabel;
      void this.sendExtensionMessage(type, payload).finally(() => {
        button.disabled = false;
        button.textContent = original;
      });
    });
  }

  showSynced(): void {
    if (!this.root) return;
    const dot = this.root.shadowRoot?.querySelector('.dot');
    dot?.classList.remove('idle', 'error');
    dot?.classList.add('completed');
    if (this.statusEl) this.statusEl.textContent = 'Synced to dashboard';
    if (this.timerEl) this.timerEl.textContent = 'Done';
    if (this.stopButton) this.stopButton.style.display = 'none';
  }

  hide(): void {
    this.isStopping = false;
    this.root?.remove();
    this.root = null;
    this.wrapEl = null;
    this.timerEl = null;
    this.statusEl = null;
    this.stopButton = null;
  }
}

function getStatusLabel(status: RecordingStatus, errorMessage?: string): string {
  if (errorMessage) return errorMessage;

  const labels: Record<RecordingStatus, string> = {
    idle: 'CHIRPY',
    requesting: 'Starting recording…',
    recording: 'CHIRPY Recording (drag to move)',
    stopping: 'Stopping…',
    completed: 'Recording saved',
    error: 'Recording failed',
  };

  return labels[status];
}
