import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
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
      '@offline': path.resolve(__dirname, 'src/offline'),
      '@api': path.resolve(__dirname, 'src/api'),
      '@config': path.resolve(__dirname, 'src/config'),
    },
  },
  server: {
    allowedHosts: ['corates.org', 'www.corates.org', 'localhost'],
  },
  plugins: [solid(), tailwindcss()],
  // server: {
  //   port: 3000,
  // },
  build: {
    target: 'esnext',
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
