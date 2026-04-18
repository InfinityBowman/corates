/**
 * Tests for CORS middleware
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createCorsMiddleware } from '../cors.js';
import { STATIC_ORIGINS } from '../../config/origins';

const TRUSTED_ORIGIN = STATIC_ORIGINS[0];

describe('CORS middleware', () => {
  it('should allow requests from static origins', async () => {
    const app = new Hono();
    app.use('*', createCorsMiddleware());
    app.get('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      headers: {
        origin: TRUSTED_ORIGIN,
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(TRUSTED_ORIGIN);
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('should handle preflight OPTIONS requests', async () => {
    const app = new Hono();
    app.use('*', createCorsMiddleware());
    app.get('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      method: 'OPTIONS',
      headers: {
        origin: TRUSTED_ORIGIN,
        'access-control-request-method': 'POST',
      },
    });

    // OPTIONS requests typically return 204 No Content
    expect([200, 204]).toContain(res.status);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
  });

  it('should fallback to first static origin for untrusted origins', async () => {
    const app = new Hono();
    app.use('*', createCorsMiddleware());
    app.get('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      headers: {
        origin: 'https://evil.com',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(TRUSTED_ORIGIN);
  });

  it('should include credentials header in preflight requests', async () => {
    const app = new Hono();
    app.use('*', createCorsMiddleware());
    app.post('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      method: 'OPTIONS',
      headers: {
        origin: TRUSTED_ORIGIN,
        'access-control-request-method': 'POST',
      },
    });

    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('should allow required headers', async () => {
    const app = new Hono();
    app.use('*', createCorsMiddleware());
    app.get('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      method: 'OPTIONS',
      headers: {
        origin: TRUSTED_ORIGIN,
        'access-control-request-headers': 'Content-Type, Authorization',
      },
    });

    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });
});
