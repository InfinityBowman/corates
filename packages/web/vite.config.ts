import path from 'node:path';
import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  build: {
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@/': path.resolve(import.meta.dirname, 'src') + '/',
    },
    dedupe: ['yjs'],
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart({
      router: {
        routeFileIgnorePattern: '(__tests__/|\\.test\\.|\\.spec\\.|server/)',
      },
      prerender: {
        enabled: true,
        crawlLinks: false,
        filter: ({ path }) => {
          const normalized = path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path;
          const allowed = [
            '/',
            '/about',
            '/terms',
            '/privacy',
            '/security',
            '/contact',
            '/resources',
            '/resources/amstar2',
            '/resources/rob2',
            '/resources/robins-i',
            '/signin',
            '/signup',
          ];
          return allowed.includes(normalized);
        },
      },
    }),
    viteReact(),
    sentryVitePlugin({
      org: 'corates',
      project: 'corates-web',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disable: !process.env.SENTRY_AUTH_TOKEN,
      reactComponentAnnotation: { enabled: true },
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
    }),
  ],
});
