/**
 * Tests for requireAdmin middleware
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { requireAdmin, isAdmin } from '../requireAdmin.js';

vi.mock('../../auth/config.js', () => {
  return {
    createAuth: vi.fn(() => ({
      api: {
        getSession: vi.fn(async ({ headers }) => {
          const userId = headers.get('x-test-user-id');
          const isAdminUser = headers.get('x-test-is-admin') === 'true';

          if (userId) {
            return {
              user: {
                id: userId,
                email: headers.get('x-test-user-email') || 'test@example.com',
                name: 'Test User',
                role: isAdminUser ? 'admin' : 'researcher',
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

describe('requireAdmin middleware', () => {
  it('should allow admin users', async () => {
    const app = new Hono();
    app.use('*', requireAdmin);
    app.get('/admin', c => c.json({ message: 'admin access granted' }));

    const res = await app.request('/admin', {
      headers: {
        'x-test-user-id': 'admin-123',
        'x-test-is-admin': 'true',
        'x-test-user-email': 'admin@example.com',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('admin access granted');
  });

  it('should block non-admin users with 403', async () => {
    const app = new Hono();
    app.use('*', requireAdmin);
    app.get('/admin', c => c.json({ message: 'admin access granted' }));

    const res = await app.request('/admin', {
      headers: {
        'x-test-user-id': 'user-123',
        'x-test-is-admin': 'false',
        'x-test-user-email': 'user@example.com',
      },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Admin access required');
  });

  it('should block unauthenticated requests with 401', async () => {
    const app = new Hono();
    app.use('*', requireAdmin);
    app.get('/admin', c => c.json({ message: 'admin access granted' }));

    const res = await app.request('/admin');

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });

  it('should set user, session, and isAdmin in context', async () => {
    const app = new Hono();
    app.use('*', requireAdmin);
    app.get('/admin', c => {
      const user = c.get('user');
      const session = c.get('session');
      const isAdminFlag = c.get('isAdmin');
      return c.json({
        userId: user.id,
        sessionId: session.id,
        isAdmin: isAdminFlag,
      });
    });

    const res = await app.request('/admin', {
      headers: {
        'x-test-user-id': 'admin-123',
        'x-test-is-admin': 'true',
        'x-test-user-email': 'admin@example.com',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('admin-123');
    expect(body.sessionId).toBe('session-123');
    expect(body.isAdmin).toBe(true);
  });

  it('should handle auth errors gracefully', async () => {
    const { createAuth } = await import('../../auth/config.js');
    createAuth.mockImplementationOnce(() => {
      throw new Error('Auth service unavailable');
    });

    const app = new Hono();
    app.use('*', requireAdmin);
    app.get('/admin', c => c.json({ message: 'admin access granted' }));

    const res = await app.request('/admin', {
      headers: {
        'x-test-user-id': 'admin-123',
      },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });
});

describe('isAdmin helper', () => {
  it('should return true for admin users', () => {
    expect(isAdmin({ role: 'admin' })).toBe(true);
  });

  it('should return false for non-admin users', () => {
    expect(isAdmin({ role: 'researcher' })).toBe(false);
    expect(isAdmin({ role: 'user' })).toBe(false);
    expect(isAdmin({ role: null })).toBe(false);
  });

  it('should return false for null/undefined users', () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});
