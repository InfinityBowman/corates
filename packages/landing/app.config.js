import { defineConfig } from '@solidjs/start/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  server: {
    preset: 'static',
    prerender: {
      routes: ['/', '/about', '/terms', '/privacy'],
      crawlLinks: true,
    },
  },
});
