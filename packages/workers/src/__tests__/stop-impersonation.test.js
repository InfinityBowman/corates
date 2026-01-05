/**
 * Tests for /api/admin/stop-impersonation endpoint
 * Tests CSRF enforcement, cookie forwarding, and error handling
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { resetTestDatabase } from './helpers.js';

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

// Mock Better Auth createAuth to control handler behavior
const mockHandler = vi.fn();
vi.mock('../auth/config.js', () => {
  return {
    createAuth: vi.fn(() => ({
      handler: mockHandler,
    })),
  };
});

let app;

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

async function fetchApp(path, init = {}) {
  const ctx = createExecutionContext();
  const req = new Request(`http://localhost${path}`, init);
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

beforeAll(async () => {
  const indexModule = await import('../index.js');
  app = indexModule.default;
});

beforeEach(async () => {
  await resetTestDatabase();
  mockHandler.mockClear();
  mockHandler.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
});

describe('/api/admin/stop-impersonation - CSRF enforcement', () => {
  it('should block POST requests without Origin or Referer', async () => {
    const res = await fetchApp('/api/admin/stop-impersonation', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: 'session=test-cookie',
      },
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error).toMatch(/Origin|Referer/i);

    // Handler should not be called when CSRF check fails
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should allow POST requests with trusted Origin', async () => {
    const res = await fetchApp('/api/admin/stop-impersonation', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:5173',
        cookie: 'session=test-cookie',
      },
    });

    expect(res.status).toBe(200);
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('should allow POST requests with trusted Referer', async () => {
    const res = await fetchApp('/api/admin/stop-impersonation', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        referer: 'http://localhost:5173/admin',
        cookie: 'session=test-cookie',
      },
    });

    expect(res.status).toBe(200);
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });
});

describe('/api/admin/stop-impersonation - Cookie forwarding', () => {
  it('should forward cookie header to Better Auth handler', async () => {
    const testCookie = 'session=test-session-token; other=value';

    await fetchApp('/api/admin/stop-impersonation', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:5173',
        cookie: testCookie,
      },
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    const authRequest = mockHandler.mock.calls[0][0];

    expect(authRequest).toBeInstanceOf(Request);
    expect(authRequest.headers.get('cookie')).toBe(testCookie);
  });

  it('should forward origin header to Better Auth handler', async () => {
    const testOrigin = 'http://localhost:5173';

    await fetchApp('/api/admin/stop-impersonation', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: testOrigin,
        cookie: 'session=test',
      },
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    const authRequest = mockHandler.mock.calls[0][0];

    expect(authRequest.headers.get('origin')).toBe(testOrigin);
  });

  it('should forward referer header to Better Auth handler', async () => {
    const testReferer = 'http://localhost:5173/admin/users';

    await fetchApp('/api/admin/stop-impersonation', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        referer: testReferer,
        cookie: 'session=test',
      },
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    const authRequest = mockHandler.mock.calls[0][0];

    expect(authRequest.headers.get('referer')).toBe(testReferer);
  });

  it('should set accept header to application/json', async () => {
    await fetchApp('/api/admin/stop-impersonation', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:5173',
        cookie: 'session=test',
      },
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    const authRequest = mockHandler.mock.calls[0][0];

    expect(authRequest.headers.get('accept')).toBe('application/json');
  });

  it('should create request to /api/auth/admin/stop-impersonating', async () => {
    await fetchApp('/api/admin/stop-impersonation', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:5173',
        cookie: 'session=test',
      },
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    const authRequest = mockHandler.mock.calls[0][0];

    expect(authRequest.url).toContain('/api/auth/admin/stop-impersonating');
    expect(authRequest.method).toBe('POST');
  });
});

describe('/api/admin/stop-impersonation - Error handling', () => {
  it('should return 500 when Better Auth handler throws', async () => {
    mockHandler.mockRejectedValueOnce(new Error('Better Auth service unavailable'));

    const res = await fetchApp('/api/admin/stop-impersonation', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:5173',
        cookie: 'session=test',
      },
    });

    expect(res.status).toBe(500);
    const body = await json(res);
    expect(body.error).toBe('Failed to stop impersonation');
  });

  it('should return Better Auth response when handler succeeds', async () => {
    const mockResponse = new Response(
      JSON.stringify({ success: true, message: 'Impersonation stopped' }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
    mockHandler.mockResolvedValueOnce(mockResponse);

    const res = await fetchApp('/api/admin/stop-impersonation', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:5173',
        cookie: 'session=test',
      },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Impersonation stopped');
  });
});
