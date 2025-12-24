/**
 * Tests for rate limiting middleware
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { rateLimit, searchRateLimit, emailRateLimit, clearRateLimitStore } from '../rateLimit.js';

describe('rateLimit middleware', () => {
  // Use unique IP addresses per test to avoid interference
  let testCounter = 0;

  beforeEach(() => {
    testCounter++;
  });

  afterEach(() => {
    clearRateLimitStore();
  });

  it('should allow requests within limit', async () => {
    const app = new Hono();
    app.use('*', rateLimit({ limit: 5, windowMs: 60000 }));
    app.get('/test', c => c.json({ message: 'success' }));

    const uniqueIP = `192.168.1.${testCounter}`;
    for (let i = 0; i < 5; i++) {
      const res = await app.request('/test', {
        headers: {
          'CF-Connecting-IP': uniqueIP,
        },
      }, { ENVIRONMENT: 'production' });
      expect(res.status).toBe(200);
    }
  });

  it('should block requests exceeding limit', async () => {
    const app = new Hono();
    app.use('*', rateLimit({ limit: 3, windowMs: 60000 }));
    app.get('/test', c => c.json({ message: 'success' }));

    const uniqueIP = `192.168.2.${testCounter}`;
    const testEnv = { ENVIRONMENT: 'production' };
    // Make 3 requests (within limit)
    for (let i = 0; i < 3; i++) {
      const res = await app.request('/test', {
        headers: {
          'CF-Connecting-IP': uniqueIP,
        },
      }, testEnv);
      expect(res.status).toBe(200);
    }

    // 4th request should be blocked
    const res = await app.request('/test', {
      headers: {
        'CF-Connecting-IP': uniqueIP,
      },
    }, testEnv);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('Too many requests');
    expect(body.retryAfter).toBeDefined();
  });

  it('should include rate limit headers', async () => {
    const app = new Hono();
    app.use('*', rateLimit({ limit: 10, windowMs: 60000 }));
    app.get('/test', c => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      headers: {
        'CF-Connecting-IP': '192.168.1.1',
      },
    }, { ENVIRONMENT: 'production' });

    expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
    expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
  });

  it('should track different IPs separately', async () => {
    const app = new Hono();
    app.use('*', rateLimit({ limit: 2, windowMs: 60000 }));
    app.get('/test', c => c.json({ message: 'success' }));

    const uniqueIP1 = `192.168.3.${testCounter}`;
    const uniqueIP2 = `192.168.4.${testCounter}`;
    const testEnv = { ENVIRONMENT: 'production' };

    // IP 1 makes 2 requests
    for (let i = 0; i < 2; i++) {
      const res = await app.request('/test', {
        headers: {
          'CF-Connecting-IP': uniqueIP1,
        },
      }, testEnv);
      expect(res.status).toBe(200);
    }

    // IP 2 should still be able to make requests
    const res = await app.request('/test', {
      headers: {
        'CF-Connecting-IP': uniqueIP2,
      },
    }, testEnv);

    expect(res.status).toBe(200);
  });

  it('should use custom key generator', async () => {
    const app = new Hono();
    app.use(
      '*',
      rateLimit({
        limit: 2,
        windowMs: 60000,
        keyGenerator: c => c.req.header('x-user-id') || 'anonymous',
      }),
    );
    app.get('/test', c => c.json({ message: 'success' }));

    const testEnv = { ENVIRONMENT: 'production' };
    // User 1 makes 2 requests
    for (let i = 0; i < 2; i++) {
      const res = await app.request('/test', {
        headers: {
          'x-user-id': 'user-1',
        },
      }, testEnv);
      expect(res.status).toBe(200);
    }

    // User 1's 3rd request should be blocked
    const res1 = await app.request('/test', {
      headers: {
        'x-user-id': 'user-1',
      },
    }, testEnv);
    expect(res1.status).toBe(429);

    // User 2 should still be able to make requests
    const res2 = await app.request('/test', {
      headers: {
        'x-user-id': 'user-2',
      },
    }, testEnv);
    expect(res2.status).toBe(200);
  });

  it('should reset after window expires', async () => {
    const app = new Hono();
    app.use('*', rateLimit({ limit: 2, windowMs: 100 })); // 100ms window
    app.get('/test', c => c.json({ message: 'success' }));

    const uniqueIP = `192.168.5.${testCounter}`;
    const testEnv = { ENVIRONMENT: 'production' };

    // Make 2 requests (within limit)
    for (let i = 0; i < 2; i++) {
      const res = await app.request('/test', {
        headers: {
          'CF-Connecting-IP': uniqueIP,
        },
      }, testEnv);
      expect(res.status).toBe(200);
    }

    // 3rd request should be blocked
    const res1 = await app.request('/test', {
      headers: {
        'CF-Connecting-IP': uniqueIP,
      },
    }, testEnv);
    expect(res1.status).toBe(429);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should be able to make requests again
    const res2 = await app.request('/test', {
      headers: {
        'CF-Connecting-IP': uniqueIP,
      },
    }, testEnv);
    expect(res2.status).toBe(200);
  });
});

describe('searchRateLimit', () => {
  let testCounter = 0;

  beforeEach(() => {
    testCounter++;
  });

  afterEach(() => {
    clearRateLimitStore();
  });

  it('should enforce search rate limit', async () => {
    const app = new Hono();
    app.use('*', searchRateLimit);
    app.get('/search', c => c.json({ results: [] }));

    const uniqueIP = `192.168.10.${testCounter}`;
    const testEnv = { ENVIRONMENT: 'production' };

    // Make requests up to limit
    for (let i = 0; i < 30; i++) {
      const res = await app.request('/search', {
        headers: {
          'CF-Connecting-IP': uniqueIP,
        },
      }, testEnv);
      expect(res.status).toBe(200);
    }

    // 31st request should be blocked
    const res = await app.request('/search', {
      headers: {
        'CF-Connecting-IP': uniqueIP,
      },
    }, testEnv);

    expect(res.status).toBe(429);
  });
});

describe('emailRateLimit', () => {
  let testCounter = 0;

  beforeEach(() => {
    testCounter++;
  });

  afterEach(() => {
    clearRateLimitStore();
  });

  it('should enforce email rate limit', async () => {
    const app = new Hono();
    app.use('*', emailRateLimit);
    app.post('/email', c => c.json({ success: true }));

    const uniqueIP = `192.168.20.${testCounter}`;
    const testEnv = { ENVIRONMENT: 'production' };

    // Make requests up to limit
    for (let i = 0; i < 5; i++) {
      const res = await app.request('/email', {
        method: 'POST',
        headers: {
          'CF-Connecting-IP': uniqueIP,
        },
      }, testEnv);
      expect(res.status).toBe(200);
    }

    // 6th request should be blocked
    const res = await app.request('/email', {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': uniqueIP,
      },
    }, testEnv);

    expect(res.status).toBe(429);
  });
});
