/**
 * Vitest Test Setup
 * Global configuration and utilities for testing
 */

import { vi } from 'vitest';

// Mock sentry module to avoid @solidjs/router import issues in tests
vi.mock('@config/sentry.js', () => ({
  initSentry: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  isSentryEnabled: vi.fn(() => false),
  Sentry: {},
}));

// Mock import.meta.env for tests
vi.stubGlobal('import.meta', {
  env: {
    VITE_API_URL: 'http://localhost:8787',
    VITE_BASEPATH: '/',
  },
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock crypto.randomUUID
if (!global.crypto) {
  global.crypto = {};
}
global.crypto.randomUUID = vi.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2));

// Helper to create mock IndexedDB for testing
export function createMockIndexedDB() {
  const _stores = new Map();

  return {
    open: vi.fn(() => {
      const request = {
        result: {
          transaction: vi.fn((_storeNames, _mode) => ({
            objectStore: vi.fn(_name => ({
              add: vi.fn(),
              put: vi.fn(),
              get: vi.fn(),
              getAll: vi.fn(),
              delete: vi.fn(),
            })),
            oncomplete: null,
            onerror: null,
          })),
          objectStoreNames: { contains: vi.fn(() => false) },
          createObjectStore: vi.fn(),
        },
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };

      // Simulate async success
      setTimeout(() => {
        if (request.onsuccess) request.onsuccess({ target: request });
      }, 0);

      return request;
    }),
  };
}
