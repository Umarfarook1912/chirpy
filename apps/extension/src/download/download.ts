import { RecordingRepository } from '../db/RecordingRepository';
import { downloadBlobInPage } from '../utils/blob.utils';

async function main(): Promise<void> {
  const statusEl = document.getElementById('status');
  const params = new URLSearchParams(window.location.search);
  const key = params.get('key');
  const filename = params.get('filename') ?? 'chirpy-meeting.webm';

  if (!key) {
    if (statusEl) statusEl.textContent = 'Missing recording key';
    return;
  }

  try {
    const repo = new RecordingRepository();
    const recording = await repo.getByKey(key);
    if (!recording?.blob || recording.blob.size === 0) {
      if (statusEl) statusEl.textContent = 'Recording not found in local storage';
      return;
    }

    if (statusEl) {
      statusEl.textContent = `Starting download (${Math.round(recording.blob.size / 1024)} KB)…`;
    }

    downloadBlobInPage(recording.blob, filename);

    if (statusEl) statusEl.textContent = 'Download started — you can close this tab';
    window.setTimeout(() => window.close(), 2_500);
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = err instanceof Error ? err.message : 'Download failed';
    }
  }
}

void main();
