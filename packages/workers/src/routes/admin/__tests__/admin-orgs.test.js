/**
 * Tests for admin organization routes
 * Tests org listing, search, and details with billing info
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedOrgMember,
  seedProject,
  json,
} from '../../../__tests__/helpers.js';

vi.mock('../../../middleware/requireAdmin.js', () => {
  return {
    isAdmin: () => true,
    requireAdmin: async (c, next) => {
      c.set('user', {
        id: 'admin-user',
        role: 'admin',
        email: 'admin@example.com',
        name: 'Admin User',
      });
      c.set('session', { id: 'admin-session' });
      c.set('isAdmin', true);
      await next();
    },
  };
});

let app;

async function fetchApp(path, init = {}) {
  const ctx = createExecutionContext();
  const req = new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      origin: 'http://localhost:5173',
      ...init.headers,
    },
  });
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

beforeAll(async () => {
  const { orgRoutes } = await import('../orgs.js');
  app = new Hono();
  app.route('/api/admin', orgRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});

describe('Admin org routes - GET /api/admin/orgs', () => {
  it('should return paginated orgs', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedOrganization({
      id: 'org-1',
      name: 'Org 1',
      slug: 'org-1',
      createdAt: nowSec,
    });

    await seedOrganization({
      id: 'org-2',
      name: 'Org 2',
      slug: 'org-2',
      createdAt: nowSec + 1,
    });

    await seedOrganization({
      id: 'org-3',
      name: 'Org 3',
      slug: 'org-3',
      createdAt: nowSec + 2,
    });

    const res = await fetchApp('/api/admin/orgs?page=1&limit=2');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.orgs).toBeDefined();
    expect(body.orgs.length).toBe(2);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(2);
    expect(body.pagination.total).toBe(3);
    expect(body.pagination.totalPages).toBe(2);
  });

  it('should search orgs by name (case-insensitive)', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedOrganization({
      id: 'org-1',
      name: 'Acme Corporation',
      slug: 'acme',
      createdAt: nowSec,
    });

    await seedOrganization({
      id: 'org-2',
      name: 'Beta Industries',
      slug: 'beta',
      createdAt: nowSec + 1,
    });

    const res = await fetchApp('/api/admin/orgs?search=acme');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.orgs.length).toBe(1);
    expect(body.orgs[0].name).toBe('Acme Corporation');
    expect(body.pagination.total).toBe(1);
  });

  it('should search orgs by slug (case-insensitive)', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedOrganization({
      id: 'org-1',
      name: 'Acme Corporation',
      slug: 'acme-corp',
      createdAt: nowSec,
    });

    await seedOrganization({
      id: 'org-2',
      name: 'Beta Industries',
      slug: 'beta-industries',
      createdAt: nowSec + 1,
    });

    const res = await fetchApp('/api/admin/orgs?search=BETA');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.orgs.length).toBe(1);
    expect(body.orgs[0].slug).toBe('beta-industries');
  });

  it('should include stats (memberCount, projectCount)', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';
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
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'member-1',
      userId,
      organizationId: orgId,
      role: 'owner',
      createdAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrgMember({
      id: 'member-2',
      userId: 'user-2',
      organizationId: orgId,
      role: 'member',
      createdAt: nowSec,
    });

    await seedProject({
      id: 'p1',
      name: 'Project 1',
      orgId,
      createdBy: userId,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchApp('/api/admin/orgs');
    expect(res.status).toBe(200);

    const body = await json(res);
    const org = body.orgs.find(o => o.id === orgId);
    expect(org).toBeDefined();
    expect(org.stats.memberCount).toBe(2);
    expect(org.stats.projectCount).toBe(1);
  });
});

describe('Admin org routes - GET /api/admin/orgs/:orgId', () => {
  it('should return org details with billing summary', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';
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
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'member-1',
      userId,
      organizationId: orgId,
      role: 'owner',
      createdAt: nowSec,
    });

    await seedProject({
      id: 'p1',
      name: 'Project 1',
      orgId,
      createdBy: userId,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchApp(`/api/admin/orgs/${orgId}`);
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.org).toBeDefined();
    expect(body.org.id).toBe(orgId);
    expect(body.stats).toBeDefined();
    expect(body.stats.memberCount).toBe(1);
    expect(body.stats.projectCount).toBe(1);
    expect(body.billing).toBeDefined();
    expect(body.billing.effectivePlanId).toBeDefined();
    expect(body.billing.source).toBeDefined();
    expect(body.billing.plan).toBeDefined();
  });

  it('should return 400 for invalid orgId', async () => {
    const res = await fetchApp('/api/admin/orgs/invalid-org-id');
    expect(res.status).toBe(400);
  });
});
