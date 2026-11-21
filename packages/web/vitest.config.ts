import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@/': path.resolve(import.meta.dirname, 'src') + '/',
    },
  },
  test: {
    environment: 'jsdom',
    // Node 25+ defines its own localStorage on globalThis, so Vitest 4 never installs jsdom's
    // and it reads as undefined. Fixed upstream in Vitest 5 (vitest-dev/vitest#10293).
    execArgv: ['--no-experimental-webstorage'],
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['src/**/*.server.test.ts'],
    testTimeout: 10000,
  },
});
