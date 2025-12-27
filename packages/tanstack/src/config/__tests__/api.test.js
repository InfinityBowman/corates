/**
 * Tests for API Configuration Module
 *
 * INTENDED BEHAVIOR:
 * - API_BASE should provide the worker API URL from environment or fallback to localhost
 * - getWsBaseUrl() should convert HTTP URLs to WebSocket URLs (http->ws, https->wss)
 */

import { describe, it, expect } from 'vitest'

describe('API Configuration', () => {
  describe('API_BASE', () => {
    it('should export API_BASE constant', async () => {
      const { API_BASE } = await import('@config/api.js')
      expect(API_BASE).toBeDefined()
      expect(typeof API_BASE).toBe('string')
      // Should either be the env value or the default
      expect(API_BASE).toMatch(/^https?:\/\//)
    })

    it('should default to localhost:8787 in test environment', async () => {
      const { API_BASE } = await import('@config/api.js')
      // In test environment without VITE_API_URL set, should use default
      expect(API_BASE).toBe('http://localhost:8787')
    })
  })

  describe('getWsBaseUrl', () => {
    it('should convert http:// to ws://', async () => {
      const { getWsBaseUrl } = await import('@config/api.js')
      expect(getWsBaseUrl('http://localhost:8787')).toBe('ws://localhost:8787')
    })

    it('should convert https:// to wss://', async () => {
      const { getWsBaseUrl } = await import('@config/api.js')
      expect(getWsBaseUrl('https://api.corates.org')).toBe(
        'wss://api.corates.org',
      )
    })

    it('should preserve the host and port in the URL', async () => {
      const { getWsBaseUrl } = await import('@config/api.js')
      expect(getWsBaseUrl('https://api.example.com:3000')).toBe(
        'wss://api.example.com:3000',
      )
    })

    it('should handle URLs with paths correctly', async () => {
      const { getWsBaseUrl } = await import('@config/api.js')
      // Note: Current implementation strips paths - this is expected behavior
      // The WebSocket base URL should not include path segments
      expect(getWsBaseUrl('https://api.corates.org/v1')).toBe(
        'wss://api.corates.org/v1',
      )
    })
  })
})
