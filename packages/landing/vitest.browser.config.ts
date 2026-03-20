import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@/': path.resolve(import.meta.dirname, 'src') + '/',
    },
  },
  optimizeDeps: {
    include: [
      'yjs',
      'dexie',
      'y-dexie',
      'zustand',
      'zustand/middleware/immer',
      'immer',
      '@corates/shared',
    ],
  },
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      headless: true,
    },
    include: ['src/**/*.browser.test.{ts,tsx}'],
    testTimeout: 15000,
  },
});
