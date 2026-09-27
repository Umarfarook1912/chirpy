import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const LOAD_TIMEOUT_MS = 60_000;

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadError: string | null = null;

export type ConvertProgress = {
  phase: 'loading' | 'writing' | 'converting' | 'done';
  percent: number;
  label: string;
};

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function getFfmpeg(onProgress?: (p: ConvertProgress) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoadError) throw new Error(ffmpegLoadError);

  onProgress?.({ phase: 'loading', percent: 5, label: 'Loading converter…' });

  const ffmpeg = new FFmpeg();
  // Same-origin assets from public/ffmpeg (vendored @ffmpeg/core) — avoids CDN/COEP hangs
  const baseURL = `${window.location.origin}/ffmpeg`;

  try {
    onProgress?.({ phase: 'loading', percent: 15, label: 'Loading FFmpeg core…' });
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    ]);
    onProgress?.({ phase: 'loading', percent: 40, label: 'Initializing FFmpeg…' });
    await withTimeout(
      ffmpeg.load({ coreURL, wasmURL }),
      LOAD_TIMEOUT_MS,
      'FFmpeg initialization timed out after 60s. Reload the page and try again.',
    );
    onProgress?.({ phase: 'loading', percent: 48, label: 'FFmpeg ready' });
  } catch (err) {
    ffmpegInstance = null;
    ffmpegLoadError =
      err instanceof Error
        ? err.message
        : 'FFmpeg failed to load. Reload the page and try again.';
    throw new Error(ffmpegLoadError);
  }

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export async function convertWebmToMp4(
  webmBlob: Blob,
  onProgress?: (p: ConvertProgress) => void,
): Promise<Blob> {
  const report = (p: ConvertProgress) => onProgress?.(p);

  const ffmpeg = await getFfmpeg(report);

  ffmpeg.on('progress', ({ progress }) => {
    const pct = Math.min(99, Math.max(50, Math.round(50 + progress * 50)));
    report({ phase: 'converting', percent: pct, label: `Converting… ${pct}%` });
  });

  report({ phase: 'writing', percent: 50, label: 'Preparing video…' });
  await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));

  report({ phase: 'converting', percent: 55, label: 'Converting… 55%' });

  let exitCode = await ffmpeg.exec([
    '-i',
    'input.webm',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-preset',
    'ultrafast',
    '-crf',
    '28',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    'output.mp4',
  ]);

  if (exitCode !== 0) {
    exitCode = await ffmpeg.exec([
      '-i',
      'input.webm',
      '-c:v',
      'mpeg4',
      '-q:v',
      '5',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      'output.mp4',
    ]);
  }

  if (exitCode !== 0) {
    throw new Error(`FFmpeg conversion failed (exit code ${exitCode})`);
  }

  const data = await ffmpeg.readFile('output.mp4');
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  if (bytes.byteLength === 0) {
    throw new Error('FFmpeg produced an empty MP4 file');
  }

  try {
    await ffmpeg.deleteFile('input.webm');
    await ffmpeg.deleteFile('output.mp4');
  } catch {
    /* ignore cleanup errors */
  }

  report({ phase: 'done', percent: 100, label: 'Done' });
  return new Blob([bytes as unknown as BlobPart], { type: 'video/mp4' });
}

/** Reset cached load errors so the user can retry after a failure. */
export function resetFfmpegCache(): void {
  ffmpegInstance = null;
  ffmpegLoadError = null;
}
