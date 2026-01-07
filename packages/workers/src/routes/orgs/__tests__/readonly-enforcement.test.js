/**
 * Tests for read-only access enforcement on org-scoped write routes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedOrgMember,
  json,
} from '@/__tests__/helpers.js';
import { createDb } from '@/db/client.js';
import { createGrant } from '@/db/orgAccessGrants.js';
import { session } from '@/db/schema.js';

// Mock auth middleware
vi.mock('@/middleware/auth.js', () => {
  return {
    requireAuth: async (c, next) => {
      const userId = c.req.raw.headers.get('x-test-user-id') || 'user-1';
      const email = c.req.raw.headers.get('x-test-user-email') || 'user1@example.com';
      c.set('user', {
        id: userId,
        email,
        name: 'Test User',
      });
      c.set('session', { id: 'test-session', activeOrganizationId: c.req.param('orgId') });
      await next();
    },
    getAuth: c => ({
      user: c.get('user'),
      session: c.get('session'),
    }),
  };
});

let app;

beforeEach(async () => {
  await resetTestDatabase();

  const { orgRoutes } = await import('../index.js');
  const { orgProjectRoutes } = await import('../projects.js');
  app = new Hono();
  app.route('/api/orgs', orgRoutes);
  app.route('/api/orgs/:orgId/projects', orgProjectRoutes);
});

async function createReadOnlyOrg() {
  const nowSec = Math.floor(Date.now() / 1000);
  const orgId = 'org-readonly';
  const userId = 'user-1';

  await seedUser({
    id: userId,
    name: 'User 1',
    email: 'user1@example.com',
    createdAt: nowSec,
    updatedAt: nowSec,
  });

  await seedOrganization({
    id: orgId,
    name: 'Read-Only Org',
    slug: 'readonly-org',
    createdAt: nowSec,
  });

  await seedOrgMember({
    id: 'member-1',
    userId,
    organizationId: orgId,
    role: 'owner',
    createdAt: nowSec,
  });

  // Create an expired grant to trigger read-only access
  const db = createDb(env.DB);
  const expiredDate = new Date();
  expiredDate.setMonth(expiredDate.getMonth() - 1); // Expired 1 month ago

  await createGrant(db, {
    id: 'grant-expired',
    orgId,
    type: 'single_project',
    startsAt: new Date(expiredDate.getTime() - 6 * 30 * 24 * 60 * 60 * 1000), // Started 7 months ago
    expiresAt: expiredDate,
  });

  // Create session with activeOrganizationId
  await db.insert(session).values({
    id: 'test-session',
    userId,
    token: 'test-token',
    expiresAt: new Date(Date.now() + 86400 * 1000),
    activeOrganizationId: orgId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { orgId, userId };
}

describe('Read-only access enforcement', () => {
  it('should block project creation for read-only org', async () => {
    const { orgId, userId } = await createReadOnlyOrg();

    const testEnv = {
      ...env,
      APP_URL: 'http://localhost:5173',
    };

    const ctx = createExecutionContext();
    const req = new Request(`http://localhost/api/orgs/${orgId}/projects`, {
      method: 'POST',
      headers: {
        'x-test-user-id': userId,
        'x-test-user-email': 'user1@example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test Project',
        description: 'Test Description',
      }),
    });
    const res = await app.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/AUTH_FORBIDDEN/);
    expect(body.details?.reason).toBe('read_only_access');
  });

  it('should allow GET requests for read-only org', async () => {
    const { orgId, userId } = await createReadOnlyOrg();

    const testEnv = {
      ...env,
      APP_URL: 'http://localhost:5173',
    };

    const ctx = createExecutionContext();
    const req = new Request(`http://localhost/api/orgs/${orgId}/projects`, {
      method: 'GET',
      headers: {
        'x-test-user-id': userId,
        'x-test-user-email': 'user1@example.com',
      },
    });
    const res = await app.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(200);
  });
});
