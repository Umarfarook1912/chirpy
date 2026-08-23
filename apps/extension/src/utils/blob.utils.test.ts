import { describe, expect, it, vi } from 'vitest';
import {
  base64ChunksToBlob,
  blobToBase64Chunks,
  blobToDataUrl,
  dataUrlToBlob,
  downloadBlobInPage,
  isValidParticipantName,
  normalizeSelfName,
  sanitizeDownloadFilename,
} from './blob.utils';

describe('blob.utils', () => {
  it('blobToDataUrl encodes blob as data URL', async () => {
    const blob = new Blob(['hello-chirpy'], { type: 'video/webm' });
    const dataUrl = await blobToDataUrl(blob);
    expect(dataUrl.startsWith('data:video/webm;base64,')).toBe(true);
    expect(atob(dataUrl.split(',')[1] ?? '')).toBe('hello-chirpy');
  });

  it('base64 chunks round-trip large blob', async () => {
    const bytes = new Uint8Array(600_000).fill(99);
    const blob = new Blob([bytes], { type: 'video/webm' });
    const chunks = await blobToBase64Chunks(blob);
    expect(chunks.length).toBeGreaterThan(1);
    const restored = base64ChunksToBlob(chunks, 'video/webm');
    expect(restored.size).toBe(600_000);
  });

  it('dataUrlToBlob round-trips with blobToDataUrl', async () => {
    const original = new Blob(['round-trip-test'], { type: 'video/webm' });
    const restored = dataUrlToBlob(await blobToDataUrl(original));
    expect(restored.size).toBe(original.size);
  });

  it('rejects invalid participant names', () => {
    expect(isValidParticipantName('1')).toBe(false);
    expect(isValidParticipantName('Umar Farook J')).toBe(true);
    expect(normalizeSelfName('You', 'Umar Farook J')).toBe('Umar Farook J');
  });

  it('downloadBlobInPage creates object URL and triggers download', () => {
    const anchor = { href: '', download: '', rel: '', click: vi.fn(), remove: vi.fn() };
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild: vi.fn() } });
    vi.stubGlobal('setTimeout', vi.fn((fn: () => void) => fn()));

    downloadBlobInPage(new Blob(['x'], { type: 'video/webm' }), 'test.webm');
    expect(anchor.click).toHaveBeenCalledOnce();
  });

  it('sanitizeDownloadFilename strips unsafe characters', () => {
    expect(sanitizeDownloadFilename('Meet - abc/test', 'webm')).toBe('chirpy-Meet_-_abc_test.webm');
  });
});
