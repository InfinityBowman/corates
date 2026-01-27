/**
 * Main app integration tests
 * Tests route mounting, middleware chain, error handling
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTestDatabase, json, fetchApp } from './helpers.js';

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
  app = await import('../index.js');
  app = app.default;
});

beforeEach(async () => {
  await resetTestDatabase();
});

describe('Main App - Route Mounting', () => {
  it('should mount health check routes', async () => {
    const res = await fetchApp(app, '/health');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.status).toBeDefined();
  });

  it('should mount healthz route', async () => {
    const res = await fetchApp(app, '/healthz');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('OK');
  });

  it('should mount root route', async () => {
    const res = await fetchApp(app, '/');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Corates Workers API');
  });

});

describe('Main App - Middleware Chain', () => {
  it('should apply CORS middleware', async () => {
    const res = await fetchApp(app, '/health', {
      headers: {
        origin: 'http://localhost:5173',
      },
    });

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('should apply security headers', async () => {
    const res = await fetchApp(app, '/health');

    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('should handle CORS preflight requests', async () => {
    const res = await fetchApp(app, '/health', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
      },
    });

    // OPTIONS requests can return 200 or 204
    expect([200, 204]).toContain(res.status);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
});

describe('Main App - Error Handling', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await fetchApp(app, '/api/nonexistent/route');
    expect(res.status).toBe(404);

    const body = await json(res);
    expect(body.code).toBe('SYSTEM_ROUTE_NOT_FOUND');
    expect(body.message).toBe('Route not found');
  });

});

describe('Main App - PDF Proxy Endpoint', () => {
  it('should require authentication', async () => {
    const res = await fetchApp(app, '/api/pdf-proxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://arxiv.org/pdf/1234.5678.pdf' }),
    });

    expect(res.status).toBe(401);
  });

  it('should reject requests without URL', async () => {
    const res = await fetchApp(app, '/api/pdf-proxy', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-1',
      },
      body: JSON.stringify({}),
    });

    // Should return 400 (validation error) or 401 (auth required)
    expect([400, 401]).toContain(res.status);
    if (res.status === 400) {
      const body = await json(res);
      expect(body.error).toMatch(/URL/i);
    }
  });

  it('should reject invalid URL protocols', async () => {
    const res = await fetchApp(app, '/api/pdf-proxy', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-1',
      },
      body: JSON.stringify({ url: 'javascript:alert(1)' }),
    });

    // Should return 400 (validation error) or 401 (auth required)
    expect([400, 401]).toContain(res.status);
  });

  it('should block SSRF attempts to internal IPs', async () => {
    const res = await fetchApp(app, '/api/pdf-proxy', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-1',
      },
      body: JSON.stringify({ url: 'https://127.0.0.1/admin' }),
    });

    expect([400, 401]).toContain(res.status);
    if (res.status === 400) {
      const body = await json(res);
      expect(body.code).toBe('SSRF_BLOCKED');
    }
  });

  it('should block SSRF attempts to localhost', async () => {
    const res = await fetchApp(app, '/api/pdf-proxy', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-1',
      },
      body: JSON.stringify({ url: 'https://localhost:8787/api/admin' }),
    });

    expect([400, 401]).toContain(res.status);
    if (res.status === 400) {
      const body = await json(res);
      expect(body.code).toBe('SSRF_BLOCKED');
    }
  });

  it('should block SSRF attempts to cloud metadata endpoints', async () => {
    const res = await fetchApp(app, '/api/pdf-proxy', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-1',
      },
      body: JSON.stringify({ url: 'http://169.254.169.254/latest/meta-data/' }),
    });

    expect([400, 401]).toContain(res.status);
    if (res.status === 400) {
      const body = await json(res);
      expect(body.code).toBe('SSRF_BLOCKED');
    }
  });

  it('should block URLs not in the allowlist', async () => {
    const res = await fetchApp(app, '/api/pdf-proxy', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-1',
      },
      body: JSON.stringify({ url: 'https://evil-site.com/malicious.pdf' }),
    });

    expect([400, 401]).toContain(res.status);
    if (res.status === 400) {
      const body = await json(res);
      expect(body.code).toBe('SSRF_BLOCKED');
    }
  });
});

describe('Main App - Durable Object Routes', () => {
  it('should return 410 Gone for legacy /api/project/:projectId route', async () => {
    const res = await fetchApp(app, '/api/project/test-project-id');
    // Legacy routes now return 410 Gone
    expect(res.status).toBe(410);
    const body = await json(res);
    expect(body.error).toBe('ENDPOINT_MOVED');
    expect(body.message).toContain('/api/orgs/:orgId/project-doc/:projectId');
  });

  it('should handle org-scoped project DO routes', async () => {
    const res = await fetchApp(app, '/api/orgs/test-org-id/project-doc/test-project-id');
    // Should return 200, 400, or 401 (auth required)
    expect([200, 400, 401]).toContain(res.status);
  });

  it('should handle user session DO routes', async () => {
    const res = await fetchApp(app, '/api/sessions/test-session-id');
    // Should return 200, 400, or 401 (auth required)
    expect([200, 400, 401]).toContain(res.status);
  });
});
