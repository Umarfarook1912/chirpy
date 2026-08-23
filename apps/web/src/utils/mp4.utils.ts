import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const FFMPEG_CORE_VERSION = '0.12.10';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadError: string | null = null;

async function getFfmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoadError) {
    throw new Error(ffmpegLoadError);
  }

  const ffmpeg = new FFmpeg();
  const baseURL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

  try {
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  } catch (err) {
    ffmpegLoadError =
      err instanceof Error
        ? `FFmpeg failed to load: ${err.message}`
        : 'FFmpeg failed to load. Check your network connection.';
    throw new Error(ffmpegLoadError);
  }

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export async function convertWebmToMp4(
  webmBlob: Blob,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const ffmpeg = await getFfmpeg();

  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.(Math.round(progress * 100));
  });

  await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));

  const exitCode = await ffmpeg.exec([
    '-i',
    'input.webm',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-preset',
    'fast',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    'output.mp4',
  ]);

  if (exitCode !== 0) {
    throw new Error(`FFmpeg conversion failed (exit code ${exitCode})`);
  }

  const data = await ffmpeg.readFile('output.mp4');
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  if (bytes.byteLength === 0) {
    throw new Error('FFmpeg produced an empty MP4 file');
  }

  return new Blob([bytes as unknown as BlobPart], { type: 'video/mp4' });
}
