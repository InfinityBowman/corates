/**
 * Tests for admin billing routes
 * Tests subscription and grant management endpoints
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  seedOrganization,
  seedSubscription,
  json,
} from '../../../__tests__/helpers.js';
import { createDb } from '../../../db/client.js';
import { subscription, orgAccessGrants } from '../../../db/schema.js';
import { eq } from 'drizzle-orm';
import { getGrantByOrgIdAndType } from '../../../db/orgAccessGrants.js';

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
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

beforeAll(async () => {
  const { billingRoutes } = await import('../billing.js');
  app = new Hono();
  app.route('/api/admin', billingRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});

describe('Admin billing routes - GET /api/admin/orgs/:orgId/billing', () => {
  it('should return org billing details', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    const res = await fetchApp(`/api/admin/orgs/${orgId}/billing`);
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.orgId).toBe(orgId);
    expect(body.billing).toBeDefined();
    expect(body.billing.effectivePlanId).toBeDefined();
    expect(body.subscriptions).toBeDefined();
    expect(Array.isArray(body.subscriptions)).toBe(true);
    expect(body.grants).toBeDefined();
    expect(Array.isArray(body.grants)).toBe(true);
  });
});

describe('Admin billing routes - POST /api/admin/orgs/:orgId/subscriptions', () => {
  it('should reject invalid plan', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    const res = await fetchApp(`/api/admin/orgs/${orgId}/subscriptions`, {
      method: 'POST',
      body: JSON.stringify({
        plan: 'invalid-plan',
        status: 'active',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('should reject invalid status', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    const res = await fetchApp(`/api/admin/orgs/${orgId}/subscriptions`, {
      method: 'POST',
      body: JSON.stringify({
        plan: 'team',
        status: 'invalid-status',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('should create subscription', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    const res = await fetchApp(`/api/admin/orgs/${orgId}/subscriptions`, {
      method: 'POST',
      body: JSON.stringify({
        plan: 'team',
        status: 'active',
        stripeSubscriptionId: 'sub_test_123',
      }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.subscription).toBeDefined();
    expect(body.subscription.plan).toBe('team');
    expect(body.subscription.status).toBe('active');
    expect(body.subscription.referenceId).toBe(orgId);
  });
});

describe('Admin billing routes - PUT /api/admin/orgs/:orgId/subscriptions/:subscriptionId', () => {
  it('should update subscription', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedSubscription({
      id: 'sub-1',
      plan: 'team',
      referenceId: orgId,
      status: 'active',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchApp(`/api/admin/orgs/${orgId}/subscriptions/sub-1`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'canceled',
        canceledAt: new Date().toISOString(),
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.subscription.status).toBe('canceled');
  });
});

describe('Admin billing routes - DELETE /api/admin/orgs/:orgId/subscriptions/:subscriptionId', () => {
  it('should cancel subscription', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedSubscription({
      id: 'sub-1',
      plan: 'team',
      referenceId: orgId,
      status: 'active',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchApp(`/api/admin/orgs/${orgId}/subscriptions/sub-1`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);

    const db = createDb(env.DB);
    const updated = await db.select().from(subscription).where(eq(subscription.id, 'sub-1')).get();
    expect(updated.status).toBe('canceled');
    expect(updated.endedAt).not.toBeNull();
  });
});

describe('Admin billing routes - POST /api/admin/orgs/:orgId/grant-trial', () => {
  it('should reject if trial already exists', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    const db = createDb(env.DB);
    const { createGrant } = await import('../../../db/orgAccessGrants.js');
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 14);

    await createGrant(db, {
      id: 'grant-1',
      orgId,
      type: 'trial',
      startsAt: now,
      expiresAt,
    });

    const res = await fetchApp(`/api/admin/orgs/${orgId}/grant-trial`, {
      method: 'POST',
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBeDefined();
  });

  it('should create trial grant', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    const res = await fetchApp(`/api/admin/orgs/${orgId}/grant-trial`, {
      method: 'POST',
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.grant).toBeDefined();
    expect(body.grant.type).toBe('trial');
    expect(body.grant.orgId).toBe(orgId);
  });
});

describe('Admin billing routes - POST /api/admin/orgs/:orgId/grant-single-project', () => {
  it('should extend existing non-revoked grant', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    const db = createDb(env.DB);
    const { createGrant } = await import('../../../db/orgAccessGrants.js');
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 6);

    await createGrant(db, {
      id: 'grant-1',
      orgId,
      type: 'single_project',
      startsAt: now,
      expiresAt,
    });

    const res = await fetchApp(`/api/admin/orgs/${orgId}/grant-single-project`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.action).toBe('extended');
    expect(body.grant.id).toBe('grant-1');
  });

  it('should create new grant if none exists', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    const res = await fetchApp(`/api/admin/orgs/${orgId}/grant-single-project`, {
      method: 'POST',
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.action).toBe('created');
    expect(body.grant.type).toBe('single_project');
  });
});

describe('Admin billing routes - PUT /api/admin/orgs/:orgId/grants/:grantId', () => {
  it('should reject when no actionable fields provided', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    const db = createDb(env.DB);
    const { createGrant } = await import('../../../db/orgAccessGrants.js');
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 14);

    const grant = await createGrant(db, {
      id: 'grant-1',
      orgId,
      type: 'trial',
      startsAt: now,
      expiresAt,
    });

    const res = await fetchApp(`/api/admin/orgs/${orgId}/grants/${grant.id}`, {
      method: 'PUT',
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBeDefined();
  });

  it('should update grant expiresAt', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    const db = createDb(env.DB);
    const { createGrant } = await import('../../../db/orgAccessGrants.js');
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 14);

    const grant = await createGrant(db, {
      id: 'grant-1',
      orgId,
      type: 'trial',
      startsAt: now,
      expiresAt,
    });

    const newExpiresAt = new Date(now);
    newExpiresAt.setDate(newExpiresAt.getDate() + 30);

    const res = await fetchApp(`/api/admin/orgs/${orgId}/grants/${grant.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        expiresAt: newExpiresAt.toISOString(),
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.grant.id).toBe(grant.id);
  });
});
