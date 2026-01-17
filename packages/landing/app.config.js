import { defineConfig } from '@solidjs/start/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    build: {
      target: ['es2020', 'safari14'],
    },
  },
  server: {
    preset: 'static',
    prerender: {
      routes: [
        '/',
        '/about',
        '/contact',
        '/pricing',
        '/privacy',
        '/resources',
        '/resources/amstar2',
        '/resources/robins-i',
        '/resources/rob2',
        '/security',
        '/terms',
      ],
      crawlLinks: true,
    },
  },
});
