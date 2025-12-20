/**
 * Tests for CORS middleware
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createCorsMiddleware } from '../cors.js';

describe('CORS middleware', () => {
  it('should allow requests from static origins', async () => {
    const app = new Hono();
    app.use('*', createCorsMiddleware({}));
    app.get('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      headers: {
        origin: 'http://localhost:5173',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('should allow requests from allowed origins in env', async () => {
    const app = new Hono();
    app.use('*', createCorsMiddleware({ ALLOWED_ORIGINS: 'https://custom.com' }));
    app.get('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      headers: {
        origin: 'https://custom.com',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://custom.com');
  });

  it('should handle preflight OPTIONS requests', async () => {
    const app = new Hono();
    app.use('*', createCorsMiddleware({}));
    app.get('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
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
    app.use('*', createCorsMiddleware({}));
    app.get('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      headers: {
        origin: 'https://evil.com',
      },
    });

    expect(res.status).toBe(200);
    // Should fallback to first static origin
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });

  it('should include credentials header', async () => {
    const app = new Hono();
    app.use('*', createCorsMiddleware({}));
    app.get('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      headers: {
        origin: 'http://localhost:5173',
      },
    });

    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('should allow required headers', async () => {
    const app = new Hono();
    app.use('*', createCorsMiddleware({}));
    app.get('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-headers': 'Content-Type, Authorization',
      },
    });

    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });
});
