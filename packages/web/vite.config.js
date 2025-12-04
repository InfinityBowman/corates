import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  base: process.env.VITE_BASEPATH || '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@routes': path.resolve(__dirname, 'src/routes'),
      '@primitives': path.resolve(__dirname, 'src/primitives'),
      '@auth': path.resolve(__dirname, 'src/auth'),
      '@auth-ui': path.resolve(__dirname, 'src/components/auth-ui'),
      '@checklist-ui': path.resolve(__dirname, 'src/components/checklist-ui'),
      '@project-ui': path.resolve(__dirname, 'src/components/project-ui'),
      '@learn-ui': path.resolve(__dirname, 'src/components/learn'),
      '@offline': path.resolve(__dirname, 'src/offline'),
      '@api': path.resolve(__dirname, 'src/api'),
      '@config': path.resolve(__dirname, 'src/config'),
    },
  },
  server: {
    allowedHosts: ['corates.org', 'www.corates.org', 'localhost'],
  },
  plugins: [
    solid(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Cache all static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Don't cache API calls - app handles offline data via IndexedDB
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Cache fonts from Google Fonts or other CDNs
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
      manifest: {
        name: 'CoRATES',
        short_name: 'CoRATES',
        description: 'Collaborative Research Appraisal Tool for Evidence Synthesis',
        theme_color: '#1d4ed8',
        background_color: '#eff6ff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  // server: {
  //   port: 3000,
  // },
  build: {
    target: 'esnext',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
});
