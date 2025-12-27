import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

import { tanstackStart } from '@tanstack/solid-start/plugin/vite'
import solidPlugin from 'vite-plugin-solid'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
      },
      pages: [
        {
          path: '/',
          prerender: { enabled: true, outputPath: '/index.html' },
        },
        {
          path: '/about',
          prerender: { enabled: true, outputPath: '/about/index.html' },
        },
        {
          path: '/contact',
          prerender: { enabled: true, outputPath: '/contact/index.html' },
        },
        {
          path: '/privacy',
          prerender: { enabled: true, outputPath: '/privacy/index.html' },
        },
        {
          path: '/resources',
          prerender: { enabled: true, outputPath: '/resources/index.html' },
        },
        {
          path: '/security',
          prerender: { enabled: true, outputPath: '/security/index.html' },
        },
        {
          path: '/terms',
          prerender: { enabled: true, outputPath: '/terms/index.html' },
        },
      ],
    }),
    solidPlugin({ ssr: true }),
  ],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@auth': path.resolve(__dirname, './src/components/auth'),
      '@checklist': path.resolve(__dirname, './src/components/checklist'),
      '@project': path.resolve(__dirname, './src/components/project'),
      '@routes': path.resolve(__dirname, './src/routes'),
      '@primitives': path.resolve(__dirname, './src/primitives'),
      '@offline': path.resolve(__dirname, './src/offline'),
      '@api': path.resolve(__dirname, './src/api'),
      '@config': path.resolve(__dirname, './src/config'),
      '@lib': path.resolve(__dirname, './src/lib'),
    },
  },
  build: {
    target: ['es2020', 'safari14'],
  },
})
