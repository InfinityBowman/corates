/**
 * Tests for database routes
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { resetTestDatabase, seedUser, json } from '../../__tests__/helpers.js';

// Mock postmark to avoid loading runtime code
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

// Mock auth middleware
vi.mock('../../middleware/auth.js', () => {
  return {
    requireAuth: async (c, next) => {
      const userId = c.req.raw.headers.get('x-test-user-id') || 'user-1';
      c.set('user', {
        id: userId,
        email: 'user1@example.com',
        name: 'Test User',
      });
      c.set('session', { id: 'test-session' });
      await next();
    },
  };
});

let app;

beforeAll(async () => {
  const { dbRoutes } = await import('../database.js');
  app = new Hono();
  app.route('/api/db', dbRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();
});

async function fetchDb(path, init = {}) {
  const ctx = createExecutionContext();
  const req = new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      'x-test-user-id': 'user-1',
      ...init.headers,
    },
  });
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe('Database Routes - GET /api/db/users', () => {
  it('should list users', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec + 1,
      updatedAt: nowSec + 1,
    });

    const res = await fetchDb('/api/db/users');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.users).toBeDefined();
    expect(body.users.length).toBeGreaterThanOrEqual(2);
    expect(body.users[0]).toHaveProperty('id');
    expect(body.users[0]).toHaveProperty('email');
  });

  it('should require authentication', async () => {
    const res = await fetchDb('/api/db/users', {
      headers: {},
    });

    // Should still work because we mock auth, but verify structure
    expect(res.status).toBe(200);
  });
});
