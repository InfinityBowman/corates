/**
 * Tests for email routes
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { json } from '@/__tests__/helpers.js';

// Mock postmark
vi.mock('postmark', () => {
  return {
    Client: class {
      constructor() {}
      sendEmail() {
        return Promise.resolve({ Message: 'mock' });
      }
    },
  };
});

let app;

beforeAll(async () => {
  const { emailRoutes } = await import('../email.js');
  app = new Hono();
  app.route('/api/email', emailRoutes);
});

beforeEach(() => {
  vi.clearAllMocks();
});

async function fetchEmail(path, init = {}) {
  const mockFetch = vi.fn(async request => {
    // Handle the full URL request from email route
    const url = typeof request === 'string' ? new URL(request) : new URL(request.url);
    if (url.pathname === '/enqueue' || url.pathname.includes('enqueue')) {
      return new Response(JSON.stringify({ success: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const testEnv = {
    ...env,
    ENVIRONMENT: 'production',
    EMAIL_QUEUE: {
      idFromName: vi.fn(() => ({ toString: () => 'do-id' })),
      get: vi.fn(() => ({
        fetch: mockFetch,
      })),
    },
  };

  const ctx = createExecutionContext();
  const req = new Request(`http://localhost${path}`, init);
  const res = await app.fetch(req, testEnv, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe('Email Routes - POST /api/email/queue', () => {
  it('should queue email with valid payload', async () => {
    const res = await fetchEmail('/api/email/queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    // EmailQueue returns 202, but route wraps it
    expect(body.queued).toBeDefined();
  });

  it('should reject request without to field', async () => {
    const res = await fetchEmail('/api/email/queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subject: 'Test Email',
        html: '<p>Test</p>',
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/VALIDATION_FIELD_REQUIRED/);
    expect(body.message || body.error).toMatch(/to|required/i);
  });

  it('should accept email with text content', async () => {
    const res = await fetchEmail('/api/email/queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        to: 'user@example.com',
        subject: 'Test Email',
        text: 'Plain text content',
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
  });

  it('should handle DO fetch errors gracefully', async () => {
    const testEnv = {
      ...env,
      EMAIL_QUEUE: {
        idFromName: vi.fn(() => ({ toString: () => 'do-id' })),
        get: vi.fn(() => ({
          fetch: vi.fn(async _request => {
            throw new Error('DO fetch failed');
          }),
        })),
      },
    };

    const ctx = createExecutionContext();
    const req = new Request('http://localhost/api/email/queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      }),
    });
    const res = await app.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(500);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/SYSTEM_EMAIL_SEND_FAILED/);
    expect(body.message || body.error).toBeDefined();
  });

  it('should enforce rate limiting', async () => {
    // Make 5 requests (within limit)
    for (let i = 0; i < 5; i++) {
      const res = await fetchEmail('/api/email/queue', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'CF-Connecting-IP': '192.168.1.1',
        },
        body: JSON.stringify({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        }),
      });
      expect(res.status).toBe(200);
    }

    // 6th request should be rate limited
    const res = await fetchEmail('/api/email/queue', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'CF-Connecting-IP': '192.168.1.1',
      },
      body: JSON.stringify({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      }),
    });

    expect(res.status).toBe(429);
  });
});
