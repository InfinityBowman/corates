import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    'packages/web': {
      entry: [
        'src/client.tsx',
        'src/router.tsx',
        'src/routes/**/*.{ts,tsx}',
        'src/routeTree.gen.ts',
        'vite.config.ts',
        'vitest.config.ts',
      ],
      project: ['src/**/*.{ts,tsx}'],
      ignore: ['src/routeTree.gen.ts'],
      ignoreDependencies: [
        '@tanstack/react-start',
        '@tanstack/react-router',
        '@tanstack/router-plugin',
        '@tanstack/eslint-config',
        'vite-tsconfig-paths',
        '@tailwindcss/vite',
        'tailwindcss',
        'tw-animate-css',
        '@fontsource-variable/geist',
        'shadcn',
        'fake-indexeddb',
        'jsdom',
        '@testing-library/jest-dom',
        '@testing-library/react',
        '@vitest/browser',
        'vitest-browser-react',
      ],
    },
    'packages/workers': {
      entry: ['src/index.ts', 'src/db/migrations/**/*.ts', 'vitest.config.ts'],
      project: ['src/**/*.ts'],
      ignoreDependencies: ['wrangler', 'cloudflare'],
    },
    'packages/shared': {
      entry: ['src/index.ts'],
      project: ['src/**/*.ts'],
    },
    'packages/mcp': {
      entry: ['src/index.ts'],
      project: ['src/**/*.ts'],
    },
    'packages/docs': {
      ignore: ['**/*'],
    },
  },
  ignore: ['**/routeTree.gen.ts', '**/*.config.{ts,js}', '.claude/**'],
  ignoreDependencies: ['agent-browser', 'dotenv', 'turbo', 'wrangler'],
  ignoreBinaries: ['hono', 'agent-browser'],
};

export default config;
