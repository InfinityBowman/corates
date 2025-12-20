/**
 * Tests for CSRF middleware
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requireTrustedOrigin } from '../csrf.js';

describe('requireTrustedOrigin middleware', () => {
  it('should allow GET requests without origin check', async () => {
    const app = new Hono();
    app.use('*', requireTrustedOrigin);
    app.get('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test');

    expect(res.status).toBe(200);
  });

  it('should allow HEAD requests without origin check', async () => {
    const app = new Hono();
    app.use('*', requireTrustedOrigin);
    app.all('/test', c => {
      if (c.req.method === 'HEAD') {
        return c.text('', 200);
      }
      return c.json({ message: 'success' });
    });

    const res = await app.request('/test', { method: 'HEAD' });

    expect(res.status).toBe(200);
  });

  it('should allow OPTIONS requests without origin check', async () => {
    const app = new Hono();
    app.use('*', requireTrustedOrigin);
    app.options('/test', c => c.text(''));

    const res = await app.request('/test', { method: 'OPTIONS' });

    expect(res.status).toBe(200);
  });

  it('should block POST requests without Origin or Referer', async () => {
    const app = new Hono();
    app.use('*', requireTrustedOrigin);
    app.post('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/Origin|Referer/i);
  });

  it('should allow POST requests with trusted Origin', async () => {
    const app = new Hono();
    app.use('*', requireTrustedOrigin);
    app.post('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:5173',
      },
    });

    expect(res.status).toBe(200);
  });

  it('should allow POST requests with trusted Referer', async () => {
    const app = new Hono();
    app.use('*', requireTrustedOrigin);
    app.post('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        referer: 'http://localhost:5173/some-page',
      },
    });

    expect(res.status).toBe(200);
  });

  it('should block POST requests with untrusted Origin', async () => {
    const app = new Hono();
    app.use('*', requireTrustedOrigin);
    app.post('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.com',
      },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Untrusted Origin');
  });

  it('should block POST requests with untrusted Referer', async () => {
    const app = new Hono();
    app.use('*', requireTrustedOrigin);
    app.post('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        referer: 'https://evil.com/page',
      },
    });

    expect(res.status).toBe(403);
  });

  it('should allow PUT requests with trusted Origin', async () => {
    const app = new Hono();
    app.use('*', requireTrustedOrigin);
    app.put('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:5173',
      },
    });

    expect(res.status).toBe(200);
  });

  it('should allow DELETE requests with trusted Origin', async () => {
    const app = new Hono();
    app.use('*', requireTrustedOrigin);
    app.delete('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      method: 'DELETE',
      headers: {
        origin: 'http://localhost:5173',
      },
    });

    expect(res.status).toBe(200);
  });

  it('should handle invalid Referer URL gracefully', async () => {
    const app = new Hono();
    app.use('*', requireTrustedOrigin);
    app.post('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        referer: 'not-a-valid-url',
      },
    });

    expect(res.status).toBe(403);
  });

  it('should respect env ALLOWED_ORIGINS', async () => {
    const app = new Hono();
    // Create middleware with custom env
    const customEnv = { ALLOWED_ORIGINS: 'https://custom.com' };
    app.use('*', (c, next) => {
      // Temporarily override env for this request
      const originalEnv = c.env;
      c.env = { ...c.env, ...customEnv };
      return requireTrustedOrigin(c, next).finally(() => {
        c.env = originalEnv;
      });
    });
    app.post('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://custom.com',
      },
    });

    expect(res.status).toBe(200);
  });
});
