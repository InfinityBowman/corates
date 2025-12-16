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
      routes: ['/', '/about', '/contact', '/terms', '/privacy', '/security'],
      crawlLinks: true,
    },
  },
});
