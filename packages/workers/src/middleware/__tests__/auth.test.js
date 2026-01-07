/**
 * Tests for auth middleware
 */

import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { requireAuth, getAuth } from '../auth.js';

vi.mock('@/auth/config.js', () => {
  return {
    createAuth: vi.fn(() => ({
      api: {
        getSession: vi.fn(async ({ headers }) => {
          // Check for test headers to simulate authenticated/unauthenticated
          const userId = headers.get('x-test-user-id');
          if (userId) {
            return {
              user: {
                id: userId,
                email: headers.get('x-test-user-email') || 'test@example.com',
                name: 'Test User',
              },
              session: {
                id: 'session-123',
                expiresAt: Date.now() + 86400000,
              },
            };
          }
          return null;
        }),
      },
    })),
  };
});

describe('requireAuth middleware', () => {
  it('should allow authenticated requests', async () => {
    const app = new Hono();
    app.use('*', requireAuth);
    app.get('/protected', c => c.json({ message: 'success' }));

    const res = await app.request('/protected', {
      headers: {
        'x-test-user-id': 'user-123',
        'x-test-user-email': 'test@example.com',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('success');
  });

  it('should block unauthenticated requests with 401', async () => {
    const app = new Hono();
    app.use('*', requireAuth);
    app.get('/protected', c => c.json({ message: 'success' }));

    const res = await app.request('/protected');

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('AUTH_REQUIRED');
    expect(body.message).toBeDefined();
    expect(body.statusCode).toBe(401);
  });

  it('should set user and session in context', async () => {
    const app = new Hono();
    app.use('*', requireAuth);
    app.get('/protected', c => {
      const auth = getAuth(c);
      return c.json({ userId: auth.user.id, sessionId: auth.session.id });
    });

    const res = await app.request('/protected', {
      headers: {
        'x-test-user-id': 'user-123',
        'x-test-user-email': 'test@example.com',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('user-123');
    expect(body.sessionId).toBe('session-123');
  });

  it('should handle auth errors gracefully', async () => {
    const { createAuth } = await import('@/auth/config.js');
    createAuth.mockImplementationOnce(() => {
      throw new Error('Auth service unavailable');
    });

    const app = new Hono();
    app.use('*', requireAuth);
    app.get('/protected', c => c.json({ message: 'success' }));

    const res = await app.request('/protected', {
      headers: {
        'x-test-user-id': 'user-123',
      },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('AUTH_REQUIRED');
    expect(body.message).toBeDefined();
    expect(body.statusCode).toBe(401);
  });
});

describe('getAuth helper', () => {
  it('should return user and session from context', async () => {
    const app = new Hono();
    app.use('*', requireAuth);
    app.get('/test', c => {
      const auth = getAuth(c);
      return c.json(auth);
    });

    const res = await app.request('/test', {
      headers: {
        'x-test-user-id': 'user-123',
        'x-test-user-email': 'test@example.com',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeDefined();
    expect(body.user.id).toBe('user-123');
    expect(body.session).toBeDefined();
    expect(body.session.id).toBe('session-123');
  });

  it('should return null values when not authenticated', () => {
    const app = new Hono();
    app.get('/test', c => {
      const auth = getAuth(c);
      return c.json(auth);
    });

    // Without requireAuth, context won't have user/session
    // This tests the helper itself
    const c = {
      get: key => {
        if (key === 'user') return null;
        if (key === 'session') return null;
        return null;
      },
    };

    const auth = getAuth(c);
    expect(auth.user).toBeNull();
    expect(auth.session).toBeNull();
  });
});
