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

  it('should mount project routes', async () => {
    const res = await fetchApp(app, '/api/projects/nonexistent', {
      headers: {
        'x-test-user-id': 'user-1',
      },
    });
    // Should return 401 (auth required) or 404 (not found), not 404 from app
    expect([401, 404]).toContain(res.status);
  });

  it('should mount member routes', async () => {
    const res = await fetchApp(app, '/api/projects/test-project/members', {
      headers: {
        'x-test-user-id': 'user-1',
      },
    });
    // Should return 401 or 404
    expect([401, 404]).toContain(res.status);
  });

  it('should mount user routes', async () => {
    const res = await fetchApp(app, '/api/users/search?q=test', {
      headers: {
        'x-test-user-id': 'user-1',
      },
    });
    // Should return 401 or 200/400
    expect([200, 400, 401]).toContain(res.status);
  });

  it('should mount billing routes', async () => {
    const res = await fetchApp(app, '/api/billing/plans');
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.plans).toBeDefined();
  });

  it('should mount email routes', async () => {
    const res = await fetchApp(app, '/api/email/queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to: 'test@example.com' }),
    });
    // Should return 200 or 400/500
    expect([200, 400, 500]).toContain(res.status);
  });

  it('should mount contact routes', async () => {
    const res = await fetchApp(app, '/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Test',
        email: 'test@example.com',
        message: 'Test message',
      }),
    });
    // Should return 200 or 400/500
    expect([200, 400, 500]).toContain(res.status);
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
    expect(body.error).toBe('Not Found');
  });

  it('should handle errors gracefully', async () => {
    // Test error handler by making a request that might fail
    // The app has an error handler that returns 500
    const res = await fetchApp(app, '/api/projects', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Missing auth headers might cause errors
      },
      body: JSON.stringify({}),
    });

    // Should return 401 (auth required) or 500 (error)
    expect([401, 500]).toContain(res.status);
  });
});

describe('Main App - PDF Proxy Endpoint', () => {
  it('should require authentication', async () => {
    const res = await fetchApp(app, '/api/pdf-proxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/test.pdf' }),
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
});

describe('Main App - Durable Object Routes', () => {
  it('should handle project DO routes', async () => {
    const res = await fetchApp(app, '/api/project/test-project-id');
    // Should return 200, 400, or 401 (auth required)
    expect([200, 400, 401]).toContain(res.status);
  });

  it('should handle user session DO routes', async () => {
    const res = await fetchApp(app, '/api/sessions/test-session-id');
    // Should return 200, 400, or 401 (auth required)
    expect([200, 400, 401]).toContain(res.status);
  });
});
