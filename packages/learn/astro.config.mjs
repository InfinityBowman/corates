import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import keystatic from '@keystatic/astro';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://app.corates.org',
  base: '/learn',
  output: 'static',
  integrations: [
    react(),
    markdoc(),
    keystatic(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  // For Cloudflare Pages deployment
  // adapter: cloudflare(),
});
