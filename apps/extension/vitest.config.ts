import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@chirpy/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@': resolve(__dirname, './src'),
    },
  },
});
