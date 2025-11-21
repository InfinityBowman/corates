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
      '@offline': path.resolve(__dirname, 'src/offline'),
      '@api': path.resolve(__dirname, 'src/api'),
    },
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
