import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: './wrangler.test.jsonc',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    include: ['src/**/*.{test,spec}.{js,ts}'],
    testTimeout: 10000,
    // workerd re-reports Better Auth APIErrors as unhandled rejections after
    // the endpoint has already turned them into responses
    onUnhandledError: error =>
      (error as { name?: string }).name === 'APIError' ? false : undefined,
  },
});
