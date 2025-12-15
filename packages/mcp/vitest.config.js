import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['__tests__/**/*.{test,spec}.js'],
    testTimeout: 10000, // 10s for network requests
  },
});
