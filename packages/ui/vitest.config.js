import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    server: {
      deps: {
        inline: [/solid-icons/, /@ark-ui/],
      },
    },
    deps: {
      optimizer: {
        web: {
          include: ['solid-js', '@zag-js/solid', '@ark-ui/solid', 'solid-icons'],
        },
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    conditions: ['development', 'browser'],
  },
});
