import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASEPATH || '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@routes': path.resolve(__dirname, 'src/routes'),
      '@primitives': path.resolve(__dirname, 'src/primitives'),
      '@auth': path.resolve(__dirname, 'src/components/auth'),
      '@checklist': path.resolve(__dirname, 'src/components/checklist'),
      '@project': path.resolve(__dirname, 'src/components/project'),
      '@offline': path.resolve(__dirname, 'src/offline'),
      '@api': path.resolve(__dirname, 'src/api'),
      '@config': path.resolve(__dirname, 'src/config'),
      '@lib': path.resolve(__dirname, 'src/lib'),
    },
  },
  server: {
    allowedHosts: ['corates.org', 'www.corates.org', 'localhost'],
  },
  plugins: [solidPlugin(), tailwindcss()],
  build: {
    target: ['es2020', 'safari14'],
    minify: mode === 'analyze' ? 'terser' : 'esbuild',
    sourcemap: mode === 'analyze',
    terserOptions: {
      format: {
        comments: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
}));
