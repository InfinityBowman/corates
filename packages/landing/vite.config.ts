import path from 'node:path';
import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import preact from '@preact/preset-vite';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  resolve: {
    alias: {
      '@/': path.resolve(import.meta.dirname, 'src') + '/',
    },
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    // React plugin - exclude Preact island files
    viteReact({ exclude: ['**/preact/**'] }),
    // Preact plugin - only process Preact island files
    preact({ include: ['**/preact/**/*.{js,jsx,ts,tsx}'] }),
  ],
});
