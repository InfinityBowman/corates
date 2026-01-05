import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import preact from '@preact/preset-vite';
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
      '@pdf': path.resolve(__dirname, 'src/components/pdf'),
      '@project': path.resolve(__dirname, 'src/components/project'),
      '@offline': path.resolve(__dirname, 'src/offline'),
      '@api': path.resolve(__dirname, 'src/api'),
      '@config': path.resolve(__dirname, 'src/config'),
      '@lib': path.resolve(__dirname, 'src/lib'),
      // Preact/compat aliases for React-style imports in Preact components
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react-dom/test-utils': 'preact/test-utils',
      'react/jsx-runtime': 'preact/jsx-runtime',
    },
  },
  server: {
    allowedHosts: ['corates.org', 'www.corates.org', 'localhost'],
  },
  plugins: [
    // SolidJS plugin - exclude Preact files
    solidPlugin({
      include: ['**/*.{js,jsx,ts,tsx}'],
      exclude: ['**/preact/**', '**/preact-2/**'],
    }),
    // Preact plugin - only process Preact files
    preact({
      include: ['**/preact/**/*.{js,jsx,ts,tsx}', '**/preact-2/**/*.{js,jsx,ts,tsx}'],
    }),
    tailwindcss(),
  ],
  build: {
    minify: mode === 'analyze' ? 'terser' : 'esbuild',
    sourcemap: mode === 'analyze',
    terserOptions: {
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: id => {
          // Separate EmbedPDF modules into their own chunks for code-splitting
          if (id.includes('@embedpdf/')) {
            // Group all font packages together (they're small and related)
            if (id.includes('@embedpdf/fonts-')) {
              return 'embedpdf-fonts';
            }
            // Extract package name from path for other packages
            const match = id.match(/@embedpdf\/([^/]+)/);
            if (match) {
              return `embedpdf-${match[1]}`;
            }
            return 'embedpdf';
          }
        },
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
