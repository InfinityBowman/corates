import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    server: {
      deps: {
        inline: [/solid-icons/, /@ark-ui/],
      },
    },
    deps: {
      optimizer: {
        web: {
          include: ['solid-js', '@ark-ui/solid', 'solid-icons'],
        },
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    conditions: ['development', 'browser'],
  },
});
