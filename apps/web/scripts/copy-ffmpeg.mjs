/**
 * Copy @ffmpeg/core assets into public/ffmpeg for same-origin loading.
 * Run: node scripts/copy-ffmpeg.mjs
 */
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, '..');
const srcDir = join(webRoot, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');
const destDir = join(webRoot, 'public', 'ffmpeg');

mkdirSync(destDir, { recursive: true });

for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  const src = join(srcDir, file);
  const dest = join(destDir, file);
  if (!existsSync(src)) {
    console.error(`Missing ${src}. Run: pnpm --filter @chirpy/web add -D @ffmpeg/core@0.12.10`);
    process.exit(1);
  }
  copyFileSync(src, dest);
  console.log(`Copied ${file}`);
}
