import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import viteReact from '@vitejs/plugin-react';
import path from 'node:path';
import type { BrowserCommand } from 'vitest/node';

// Seed test data by calling the running workers backend
const seedTestData: BrowserCommand<[data: Record<string, unknown>]> = async (_ctx, data) => {
  const res = await fetch('http://localhost:8787/api/test/seed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Seed failed: ${res.status} ${await res.text()}`);
  return res.json();
};

const getSessionCookie: BrowserCommand<[userId: string]> = async (_ctx, userId) => {
  const res = await fetch('http://localhost:8787/api/test/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`Session failed: ${res.status} ${await res.text()}`);
  return res.json();
};

const cleanupTestData: BrowserCommand<[data: Record<string, unknown>]> = async (_ctx, data) => {
  const res = await fetch('http://localhost:8787/api/test/cleanup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Cleanup failed: ${res.status} ${await res.text()}`);
  return res.json();
};

export default defineConfig({
  resolve: {
    alias: {
      '@/': path.resolve(import.meta.dirname, 'src') + '/',
    },
  },
  plugins: [viteReact()],
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'yjs',
      'dexie',
      'y-dexie',
      'zustand',
      'zustand/middleware/immer',
      'zustand/shallow',
      'immer',
      '@corates/shared',
      '@tanstack/react-router',
      '@tanstack/react-query',
      'vitest-browser-react',
      'sonner',
      'better-auth/react',
      'better-auth/client/plugins',
      'lucide-react',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
      'y-websocket',
      '@sentry/react',
      '@embedpdf/pdfium',
      '@embedpdf/engines/pdfium',
      '@embedpdf/models',
      'd3',
      'countup.js',
      'input-otp',
      'radix-ui',
    ],
  },
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      headless: true,
      commands: {
        seedTestData,
        getSessionCookie,
        cleanupTestData,
      },
    },
    include: ['src/__e2e__/**/*.browser.test.{ts,tsx}'],
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
});
