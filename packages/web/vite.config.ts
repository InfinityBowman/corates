import path from 'node:path';
import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
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
        // Exclude server test files + tests/helper dirs from route generation.
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
  ],
});
