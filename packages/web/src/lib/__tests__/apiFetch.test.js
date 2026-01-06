/**
 * Tests for apiFetch wrapper
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch } from '../apiFetch.js';

// Mock dependencies
vi.mock('@config/api.js', () => ({
  API_BASE: 'http://localhost:8787',
}));

vi.mock('@corates/ui', () => ({
  showToast: {
    error: vi.fn(),
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('apiFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic requests', () => {
    it('should make GET request with correct defaults', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: '123', name: 'Test' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const result = await apiFetch('/api/projects');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/projects',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
      expect(result).toEqual({ id: '123', name: 'Test' });
    });

    it('should handle path without leading slash', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      await apiFetch('api/projects');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/projects',
        expect.any(Object),
      );
    });

    it('should return raw response when raw=true', async () => {
      const response = new Response('raw data', { status: 200 });
      mockFetch.mockResolvedValueOnce(response);

      const result = await apiFetch('/api/data', { raw: true });

      expect(result).toBeInstanceOf(Response);
    });
  });

  describe('JSON body handling', () => {
    it('should stringify plain object body and set Content-Type', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: '456' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      );

      await apiFetch('/api/projects', {
        method: 'POST',
        body: { name: 'New Project', description: 'Test' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/projects',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ name: 'New Project', description: 'Test' }),
        }),
      );
    });

    it('should pass through FormData without setting Content-Type', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ uploaded: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const formData = new FormData();
      formData.append('file', new Blob(['test']), 'test.txt');

      await apiFetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.body).toBe(formData);
      // Should NOT have Content-Type header (browser sets it with boundary)
      expect(callArgs.headers['Content-Type']).toBeUndefined();
    });

    it('should pass through string body without modification', async () => {
      mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

      await apiFetch('/api/data', {
        method: 'POST',
        body: 'raw string body',
      });

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.body).toBe('raw string body');
    });
  });

  describe('convenience methods', () => {
    it('apiFetch.get should make GET request', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      await apiFetch.get('/api/items');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/items',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('apiFetch.post should make POST request with body', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: '1' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      );

      await apiFetch.post('/api/items', { name: 'Test' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Test' }),
        }),
      );
    });

    it('apiFetch.put should make PUT request', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ updated: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      await apiFetch.put('/api/items/1', { name: 'Updated' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/items/1',
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('apiFetch.patch should make PATCH request', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ patched: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      await apiFetch.patch('/api/items/1', { name: 'Patched' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/items/1',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    it('apiFetch.delete should make DELETE request', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

      await apiFetch.delete('/api/items/1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/items/1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('error handling', () => {
    it('should throw domain error on 4xx response', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found',
            statusCode: 404,
          }),
          { status: 404, headers: { 'content-type': 'application/json' } },
        ),
      );

      await expect(apiFetch('/api/projects/999')).rejects.toMatchObject({
        code: 'PROJECT_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should throw domain error on 5xx response', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'INTERNAL_ERROR',
            message: 'Server error',
            statusCode: 500,
          }),
          { status: 500, headers: { 'content-type': 'application/json' } },
        ),
      );

      await expect(apiFetch('/api/data')).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        statusCode: 500,
      });
    });

    it('should pass custom toastMessage as toastTitle', async () => {
      // Import showToast mock to verify calls
      const { showToast } = await import('@corates/ui');

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'SOME_ERROR',
            message: 'Error occurred',
            statusCode: 400,
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
      );

      await expect(
        apiFetch('/api/data', { toastMessage: 'Custom error message' }),
      ).rejects.toBeDefined();

      expect(showToast.error).toHaveBeenCalledWith('Custom error message', expect.anything());
    });

    it('should not show toast when showToast=false', async () => {
      const { showToast } = await import('@corates/ui');

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'SOME_ERROR',
            message: 'Error occurred',
            statusCode: 400,
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
      );

      await expect(apiFetch('/api/data', { showToast: false })).rejects.toBeDefined();

      expect(showToast.error).not.toHaveBeenCalled();
    });
  });

  describe('abort signal', () => {
    it('should pass signal to fetch', async () => {
      const controller = new AbortController();

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      await apiFetch('/api/data', { signal: controller.signal });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: controller.signal }),
      );
    });

    it('should throw AbortError when aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      mockFetch.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));

      await expect(apiFetch('/api/data', { signal: controller.signal })).rejects.toThrow();
    });
  });

  describe('retry behavior', () => {
    it('should not retry by default (retry=0)', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'SERVER_ERROR',
            message: 'Server error',
            statusCode: 500,
          }),
          { status: 500, headers: { 'content-type': 'application/json' } },
        ),
      );

      await expect(apiFetch('/api/data')).rejects.toBeDefined();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 5xx when retry > 0', async () => {
      // First call fails with 500, second succeeds
      mockFetch
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              code: 'SERVER_ERROR',
              message: 'Server error',
              statusCode: 500,
            }),
            { status: 500, headers: { 'content-type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );

      const result = await apiFetch('/api/data', {
        retry: 1,
        retryOptions: { baseDelayMs: 10 }, // Fast retry for tests
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    });

    it('should not retry on 4xx errors', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'BAD_REQUEST',
            message: 'Bad request',
            statusCode: 400,
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
      );

      await expect(
        apiFetch('/api/data', { retry: 2, retryOptions: { baseDelayMs: 10 } }),
      ).rejects.toBeDefined();

      // Should only call once - no retry on 4xx
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should respect max retries', async () => {
      // All calls fail with 500
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'SERVER_ERROR',
            message: 'Server error',
            statusCode: 500,
          }),
          { status: 500, headers: { 'content-type': 'application/json' } },
        ),
      );

      await expect(
        apiFetch('/api/data', { retry: 2, retryOptions: { baseDelayMs: 10 } }),
      ).rejects.toBeDefined();

      // Initial call + 2 retries = 3 total
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('non-JSON responses', () => {
    it('should return text for non-JSON response', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Plain text response', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
      );

      const result = await apiFetch('/api/text');

      expect(result).toBe('Plain text response');
    });

    it('should return null for empty response', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

      const result = await apiFetch('/api/empty');

      expect(result).toBeNull();
    });
  });
});
