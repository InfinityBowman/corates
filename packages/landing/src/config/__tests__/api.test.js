/**
 * Tests for API Configuration Module
 *
 * INTENDED BEHAVIOR:
 * - API_BASE should provide the worker API URL from environment or fallback to localhost
 * - getWsBaseUrl() should convert HTTP URLs to WebSocket URLs (http->ws, https->wss)
 */

import { describe, it, expect } from 'vitest';

describe('API Configuration', () => {
  describe('getWsBaseUrl', () => {
    it('should convert http:// to ws://', async () => {
      const { getWsBaseUrl } = await import('@/config/api');
      expect(getWsBaseUrl('http://localhost:8787')).toBe('ws://localhost:8787');
    });

    it('should convert https:// to wss://', async () => {
      const { getWsBaseUrl } = await import('@/config/api');
      expect(getWsBaseUrl('https://corates.org')).toBe('wss://corates.org');
    });

    it('should preserve the host and port in the URL', async () => {
      const { getWsBaseUrl } = await import('@/config/api');
      expect(getWsBaseUrl('https://api.example.com:3000')).toBe('wss://api.example.com:3000');
    });

    it('should handle URLs with paths correctly', async () => {
      const { getWsBaseUrl } = await import('@/config/api');
      // Note: Current implementation preserves paths
      expect(getWsBaseUrl('https://corates.org/v1')).toBe('wss://corates.org/v1');
    });
  });
});
