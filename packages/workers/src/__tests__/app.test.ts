/**
 * Main app integration tests
 * Tests route mounting, middleware chain, error handling
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTestDatabase, json, fetchApp } from './helpers.js';
import { STATIC_ORIGINS } from '../config/origins';

const TRUSTED_ORIGIN = STATIC_ORIGINS[0];

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

let app: any;

beforeAll(async () => {
  app = await import('../index.js');
  app = app.default;
});

beforeEach(async () => {
  await resetTestDatabase();
});

describe('Main App - Route Mounting', () => {
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
        origin: TRUSTED_ORIGIN,
      },
    });

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(TRUSTED_ORIGIN);
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
        origin: TRUSTED_ORIGIN,
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

describe('Main App - Durable Object Routes', () => {
  it('should return 410 Gone for legacy /api/project/:projectId route', async () => {
    const res = await fetchApp(app, '/api/project/test-project-id');
    expect(res.status).toBe(410);
    const body = await json(res);
    expect(body.error).toBe('ENDPOINT_MOVED');
    expect(body.message).toContain('/api/orgs/:orgId/project-doc/:projectId');
  });
});
