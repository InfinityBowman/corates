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
    it('converts http(s) API URLs to WebSocket URLs', async () => {
      const { getWsBaseUrl } = await import('@/config/api');
      expect(getWsBaseUrl('http://localhost:8787')).toBe('ws://localhost:8787');
      expect(getWsBaseUrl('https://corates.org')).toBe('wss://corates.org');
      expect(getWsBaseUrl('https://api.example.com:3000')).toBe('wss://api.example.com:3000');
      expect(getWsBaseUrl('https://corates.org/v1')).toBe('wss://corates.org/v1');
    });
  });
});
