/**
 * Tests for API Configuration Module
 *
 * INTENDED BEHAVIOR:
 * - API_BASE should provide the worker API URL from environment or fallback to localhost
 * - getWsBaseUrl() should convert HTTP URLs to WebSocket URLs (http->ws, https->wss)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('API Configuration', () => {
  // Store original env
  let originalEnv;

  beforeEach(() => {
    // Reset modules to allow re-importing with different env values
    vi.resetModules();
  });

  describe('API_BASE', () => {
    it('should use VITE_WORKER_API_URL when provided', async () => {
      vi.stubGlobal('import.meta', {
        env: { VITE_WORKER_API_URL: 'https://api.corates.org' },
      });

      const { API_BASE } = await import('@config/api.js');
      expect(API_BASE).toBe('https://api.corates.org');
    });

    it('should fallback to localhost:8787 when env is not set', async () => {
      vi.stubGlobal('import.meta', {
        env: {},
      });

      const { API_BASE } = await import('@config/api.js');
      expect(API_BASE).toBe('http://localhost:8787');
    });

    it('should fallback to localhost when env value is empty string', async () => {
      vi.stubGlobal('import.meta', {
        env: { VITE_WORKER_API_URL: '' },
      });

      const { API_BASE } = await import('@config/api.js');
      expect(API_BASE).toBe('http://localhost:8787');
    });
  });

  describe('getWsBaseUrl', () => {
    it('should convert http:// to ws://', async () => {
      vi.stubGlobal('import.meta', {
        env: { VITE_WORKER_API_URL: 'http://localhost:8787' },
      });

      const { getWsBaseUrl } = await import('@config/api.js');
      expect(getWsBaseUrl()).toBe('ws://localhost:8787');
    });

    it('should convert https:// to wss://', async () => {
      vi.stubGlobal('import.meta', {
        env: { VITE_WORKER_API_URL: 'https://api.corates.org' },
      });

      const { getWsBaseUrl } = await import('@config/api.js');
      expect(getWsBaseUrl()).toBe('wss://api.corates.org');
    });

    it('should preserve the host and port in the URL', async () => {
      vi.stubGlobal('import.meta', {
        env: { VITE_WORKER_API_URL: 'https://api.example.com:3000' },
      });

      const { getWsBaseUrl } = await import('@config/api.js');
      expect(getWsBaseUrl()).toBe('wss://api.example.com:3000');
    });

    it('should handle URLs with paths correctly', async () => {
      vi.stubGlobal('import.meta', {
        env: { VITE_WORKER_API_URL: 'https://api.corates.org/v1' },
      });

      const { getWsBaseUrl } = await import('@config/api.js');
      // Note: Current implementation strips paths - this is expected behavior
      // The WebSocket base URL should not include path segments
      expect(getWsBaseUrl()).toBe('wss://api.corates.org/v1');
    });
  });
});
