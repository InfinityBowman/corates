import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { buildAdminUser, buildOrg, buildUser, resetCounter } from '@/__tests__/server/factories';
import { createDb } from '@corates/db/client';
import { orgAccessGrants as grantsTable, organization, subscription } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { handleGet as billingHandler } from '../orgs/$orgId/billing';
import { handlePost as createSubscriptionHandler } from '../orgs/$orgId/subscriptions';
import {
  handlePut as updateSubscriptionHandler,
  handleDelete as deleteSubscriptionHandler,
} from '../orgs/$orgId/subscriptions/$subscriptionId';
import { handlePost as createGrantHandler } from '../orgs/$orgId/grants';
import {
  handlePut as updateGrantHandler,
  handleDelete as deleteGrantHandler,
} from '../orgs/$orgId/grants/$grantId';
import { handlePost as grantTrialHandler } from '../orgs/$orgId/grant-trial';
import { handlePost as grantSingleProjectHandler } from '../orgs/$orgId/grant-single-project';

let sessionResult: {
  user: { id: string; email: string; name: string; role?: string };
  session: { id: string; userId: string; activeOrganizationId: string | null };
} | null = null;

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => sessionResult,
}));

const { mockNotifyOrgMembers } = vi.hoisted(() => ({
  mockNotifyOrgMembers: vi.fn(async () => ({ notified: 0, failed: 0 })),
}));

vi.mock('@corates/workers/notify', () => ({
  notifyOrgMembers: mockNotifyOrgMembers,
  EventTypes: {
    SUBSCRIPTION_UPDATED: 'subscription:updated',
    SUBSCRIPTION_CANCELED: 'subscription:canceled',
  },
}));

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  resetCounter();
  sessionResult = null;
});

async function asAdmin() {
  const admin = await buildAdminUser();
  sessionResult = {
    user: { id: admin.id, email: admin.email, name: admin.name, role: 'admin' },
    session: { id: 'admin-sess', userId: admin.id, activeOrganizationId: null },
  };
  return admin;
}

async function asUser() {
  const u = await buildUser();
  sessionResult = {
    user: { id: u.id, email: u.email, name: u.name, role: 'user' },
    session: { id: 'sess', userId: u.id, activeOrganizationId: null },
  };
  return u;
}

function jsonReq(path: string, method: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/admin/orgs/:orgId/billing', () => {
  it('returns 401 when no session', async () => {
    const res = await billingHandler({
      request: new Request('http://localhost/api/admin/orgs/org-x/billing'),
      params: { orgId: 'org-x' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    await asUser();
    const res = await billingHandler({
      request: new Request('http://localhost/api/admin/orgs/org-x/billing'),
      params: { orgId: 'org-x' },
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 for non-existent org', async () => {
    await asAdmin();
    const res = await billingHandler({
      request: new Request('http://localhost/api/admin/orgs/missing/billing'),
      params: { orgId: 'missing' },
    });
    expect(res.status).toBe(400);
  });

  it('returns billing snapshot with subscriptions + grants', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const db = createDb(env.DB);
    await db.insert(subscription).values({
      id: 'sub-1',
      plan: 'team',
      referenceId: org.id,
      status: 'active',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      periodStart: new Date(),
      periodEnd: null,
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(grantsTable).values({
      id: 'gr-1',
      orgId: org.id,
      type: 'trial',
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      revokedAt: null,
      stripeCheckoutSessionId: null,
      metadata: null,
    });

    const res = await billingHandler({
      request: new Request(`http://localhost/api/admin/orgs/${org.id}/billing`),
      params: { orgId: org.id },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      orgId: string;
      billing: { effectivePlanId: string; source: string; plan: { name: string } };
      subscriptions: { id: string }[];
      grants: { id: string; type: string }[];
    };
    expect(body.orgId).toBe(org.id);
    expect(body.billing.plan.name).toBeDefined();
    expect(body.subscriptions.find(s => s.id === 'sub-1')).toBeDefined();
    expect(body.grants.find(g => g.id === 'gr-1')).toBeDefined();
  });
});

describe('POST /api/admin/orgs/:orgId/subscriptions', () => {
  it('returns 401 when no session', async () => {
    const res = await createSubscriptionHandler({
      request: jsonReq('/api/admin/orgs/org-x/subscriptions', 'POST', {}),
      params: { orgId: 'org-x' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    await asUser();
    const res = await createSubscriptionHandler({
      request: jsonReq('/api/admin/orgs/org-x/subscriptions', 'POST', {
        plan: 'team',
        status: 'active',
      }),
      params: { orgId: 'org-x' },
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid plan enum', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const res = await createSubscriptionHandler({
      request: jsonReq(`/api/admin/orgs/${org.id}/subscriptions`, 'POST', {
        plan: 'bogus',
        status: 'active',
      }),
      params: { orgId: org.id },
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-existent org', async () => {
    await asAdmin();
    const res = await createSubscriptionHandler({
      request: jsonReq('/api/admin/orgs/missing/subscriptions', 'POST', {
        plan: 'team',
        status: 'active',
      }),
      params: { orgId: 'missing' },
    });
    expect(res.status).toBe(400);
  });

  it('creates subscription and dispatches notify', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const res = await createSubscriptionHandler({
      request: jsonReq(`/api/admin/orgs/${org.id}/subscriptions`, 'POST', {
        plan: 'team',
        status: 'active',
        stripeCustomerId: 'cus_1',
      }),
      params: { orgId: org.id },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      success: boolean;
      subscription: { id: string; plan: string; referenceId: string; status: string };
    };
    expect(body.subscription.plan).toBe('team');
    expect(body.subscription.referenceId).toBe(org.id);
    expect(mockNotifyOrgMembers).toHaveBeenCalledTimes(1);

    const db = createDb(env.DB);
    const rows = await db
      .select()
      .from(subscription)
      .where(eq(subscription.id, body.subscription.id));
    expect(rows.length).toBe(1);
  });
});

describe('PUT /api/admin/orgs/:orgId/subscriptions/:subscriptionId', () => {
  it('returns 400 for non-existent subscription', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const res = await updateSubscriptionHandler({
      request: jsonReq(`/api/admin/orgs/${org.id}/subscriptions/nope`, 'PUT', { status: 'paused' }),
      params: { orgId: org.id, subscriptionId: 'nope' },
    });
    expect(res.status).toBe(400);
  });

  it('updates only provided fields and notifies', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const db = createDb(env.DB);
    const initialPeriodStart = new Date();
    await db.insert(subscription).values({
      id: 'sub-upd',
      plan: 'team',
      referenceId: org.id,
      status: 'active',
      periodStart: initialPeriodStart,
      periodEnd: null,
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await updateSubscriptionHandler({
      request: jsonReq(`/api/admin/orgs/${org.id}/subscriptions/sub-upd`, 'PUT', {
        status: 'paused',
        cancelAtPeriodEnd: true,
      }),
      params: { orgId: org.id, subscriptionId: 'sub-upd' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      subscription: { id: string; status: string; cancelAtPeriodEnd: boolean; plan: string };
    };
    expect(body.subscription.status).toBe('paused');
    expect(body.subscription.cancelAtPeriodEnd).toBe(true);
    expect(body.subscription.plan).toBe('team');
    expect(mockNotifyOrgMembers).toHaveBeenCalledTimes(1);
  });
});

describe('DELETE /api/admin/orgs/:orgId/subscriptions/:subscriptionId', () => {
  it('returns 400 for non-existent subscription', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const res = await deleteSubscriptionHandler({
      request: new Request(`http://localhost/api/admin/orgs/${org.id}/subscriptions/nope`, {
        method: 'DELETE',
      }),
      params: { orgId: org.id, subscriptionId: 'nope' },
    });
    expect(res.status).toBe(400);
  });

  it('soft-cancels and notifies', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const db = createDb(env.DB);
    await db.insert(subscription).values({
      id: 'sub-del',
      plan: 'team',
      referenceId: org.id,
      status: 'active',
      periodStart: new Date(),
      periodEnd: null,
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await deleteSubscriptionHandler({
      request: new Request(`http://localhost/api/admin/orgs/${org.id}/subscriptions/sub-del`, {
        method: 'DELETE',
      }),
      params: { orgId: org.id, subscriptionId: 'sub-del' },
    });
    expect(res.status).toBe(200);
    const [row] = await db
      .select({ status: subscription.status, endedAt: subscription.endedAt })
      .from(subscription)
      .where(eq(subscription.id, 'sub-del'));
    expect(row.status).toBe('canceled');
    expect(row.endedAt).toBeInstanceOf(Date);
    expect(mockNotifyOrgMembers).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/admin/orgs/:orgId/grants', () => {
  it('returns 400 for non-existent org', async () => {
    await asAdmin();
    const startsAt = new Date();
    const expiresAt = new Date(Date.now() + 86400000);
    const res = await createGrantHandler({
      request: jsonReq('/api/admin/orgs/missing/grants', 'POST', {
        type: 'trial',
        startsAt,
        expiresAt,
      }),
      params: { orgId: 'missing' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects second trial for same org', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const startsAt = new Date();
    const expiresAt = new Date(Date.now() + 14 * 86400000);
    const first = await createGrantHandler({
      request: jsonReq(`/api/admin/orgs/${org.id}/grants`, 'POST', {
        type: 'trial',
        startsAt,
        expiresAt,
      }),
      params: { orgId: org.id },
    });
    expect(first.status).toBe(201);

    const second = await createGrantHandler({
      request: jsonReq(`/api/admin/orgs/${org.id}/grants`, 'POST', {
        type: 'trial',
        startsAt,
        expiresAt,
      }),
      params: { orgId: org.id },
    });
    expect(second.status).toBe(400);
  });

  it('rejects expiresAt <= startsAt', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const ts = new Date();
    const res = await createGrantHandler({
      request: jsonReq(`/api/admin/orgs/${org.id}/grants`, 'POST', {
        type: 'single_project',
        startsAt: ts,
        expiresAt: ts,
      }),
      params: { orgId: org.id },
    });
    expect(res.status).toBe(400);
  });

  it('creates a single_project grant', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const startsAt = new Date();
    const expiresAt = new Date(Date.now() + 30 * 86400000);
    const res = await createGrantHandler({
      request: jsonReq(`/api/admin/orgs/${org.id}/grants`, 'POST', {
        type: 'single_project',
        startsAt,
        expiresAt,
      }),
      params: { orgId: org.id },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { grant: { id: string; type: string; orgId: string } };
    expect(body.grant.type).toBe('single_project');
    expect(body.grant.orgId).toBe(org.id);
  });
});

describe('PUT /api/admin/orgs/:orgId/grants/:grantId', () => {
  it('returns 400 when no actionable fields', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const db = createDb(env.DB);
    await db.insert(grantsTable).values({
      id: 'gr-empty',
      orgId: org.id,
      type: 'trial',
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      revokedAt: null,
      stripeCheckoutSessionId: null,
      metadata: null,
    });

    const res = await updateGrantHandler({
      request: jsonReq(`/api/admin/orgs/${org.id}/grants/gr-empty`, 'PUT', {}),
      params: { orgId: org.id, grantId: 'gr-empty' },
    });
    expect(res.status).toBe(400);
  });

  it('updates expiresAt', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const db = createDb(env.DB);
    await db.insert(grantsTable).values({
      id: 'gr-ext',
      orgId: org.id,
      type: 'single_project',
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      revokedAt: null,
      stripeCheckoutSessionId: null,
      metadata: null,
    });
    const newExpires = new Date(Date.now() + 60 * 86400000);
    const res = await updateGrantHandler({
      request: jsonReq(`/api/admin/orgs/${org.id}/grants/gr-ext`, 'PUT', {
        expiresAt: newExpires,
      }),
      params: { orgId: org.id, grantId: 'gr-ext' },
    });
    expect(res.status).toBe(200);
  });

  it('revokes and unrevokes', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const db = createDb(env.DB);
    await db.insert(grantsTable).values({
      id: 'gr-rev',
      orgId: org.id,
      type: 'single_project',
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      revokedAt: null,
      stripeCheckoutSessionId: null,
      metadata: null,
    });

    const revRes = await updateGrantHandler({
      request: jsonReq(`/api/admin/orgs/${org.id}/grants/gr-rev`, 'PUT', {
        revokedAt: new Date(),
      }),
      params: { orgId: org.id, grantId: 'gr-rev' },
    });
    expect(revRes.status).toBe(200);
    const [revoked] = await db
      .select({ revokedAt: grantsTable.revokedAt })
      .from(grantsTable)
      .where(eq(grantsTable.id, 'gr-rev'));
    expect(revoked.revokedAt).toBeInstanceOf(Date);

    const unrevRes = await updateGrantHandler({
      request: jsonReq(`/api/admin/orgs/${org.id}/grants/gr-rev`, 'PUT', { revokedAt: null }),
      params: { orgId: org.id, grantId: 'gr-rev' },
    });
    expect(unrevRes.status).toBe(200);
    const [unrevoked] = await db
      .select({ revokedAt: grantsTable.revokedAt })
      .from(grantsTable)
      .where(eq(grantsTable.id, 'gr-rev'));
    expect(unrevoked.revokedAt).toBeNull();
  });
});

describe('DELETE /api/admin/orgs/:orgId/grants/:grantId', () => {
  it('returns 400 for non-existent grant', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const res = await deleteGrantHandler({
      request: new Request(`http://localhost/api/admin/orgs/${org.id}/grants/nope`, {
        method: 'DELETE',
      }),
      params: { orgId: org.id, grantId: 'nope' },
    });
    expect(res.status).toBe(400);
  });

  it('revokes the grant', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const db = createDb(env.DB);
    await db.insert(grantsTable).values({
      id: 'gr-del',
      orgId: org.id,
      type: 'single_project',
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      revokedAt: null,
      stripeCheckoutSessionId: null,
      metadata: null,
    });

    const res = await deleteGrantHandler({
      request: new Request(`http://localhost/api/admin/orgs/${org.id}/grants/gr-del`, {
        method: 'DELETE',
      }),
      params: { orgId: org.id, grantId: 'gr-del' },
    });
    expect(res.status).toBe(200);
    const [row] = await db
      .select({ revokedAt: grantsTable.revokedAt })
      .from(grantsTable)
      .where(eq(grantsTable.id, 'gr-del'));
    expect(row.revokedAt).toBeInstanceOf(Date);
  });
});

describe('POST /api/admin/orgs/:orgId/grant-trial', () => {
  it('returns 400 for non-existent org', async () => {
    await asAdmin();
    const res = await grantTrialHandler({
      request: new Request('http://localhost/api/admin/orgs/missing/grant-trial', {
        method: 'POST',
      }),
      params: { orgId: 'missing' },
    });
    expect(res.status).toBe(400);
  });

  it('creates a 14-day trial', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const res = await grantTrialHandler({
      request: new Request(`http://localhost/api/admin/orgs/${org.id}/grant-trial`, {
        method: 'POST',
      }),
      params: { orgId: org.id },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { grant: { type: string; orgId: string } };
    expect(body.grant.type).toBe('trial');
    expect(body.grant.orgId).toBe(org.id);
  });

  it('rejects when trial already exists', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const first = await grantTrialHandler({
      request: new Request(`http://localhost/api/admin/orgs/${org.id}/grant-trial`, {
        method: 'POST',
      }),
      params: { orgId: org.id },
    });
    expect(first.status).toBe(201);

    const second = await grantTrialHandler({
      request: new Request(`http://localhost/api/admin/orgs/${org.id}/grant-trial`, {
        method: 'POST',
      }),
      params: { orgId: org.id },
    });
    expect(second.status).toBe(400);
  });
});

describe('POST /api/admin/orgs/:orgId/grant-single-project', () => {
  it('returns 400 for non-existent org', async () => {
    await asAdmin();
    const res = await grantSingleProjectHandler({
      request: new Request('http://localhost/api/admin/orgs/missing/grant-single-project', {
        method: 'POST',
      }),
      params: { orgId: 'missing' },
    });
    expect(res.status).toBe(400);
  });

  it('creates a fresh grant when none exists', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const res = await grantSingleProjectHandler({
      request: new Request(`http://localhost/api/admin/orgs/${org.id}/grant-single-project`, {
        method: 'POST',
      }),
      params: { orgId: org.id },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { action: string; grant: { type: string } };
    expect(body.action).toBe('created');
    expect(body.grant.type).toBe('single_project');
  });

  it('extends existing non-revoked grant by 6 months', async () => {
    await asAdmin();
    const { org } = await buildOrg();
    const db = createDb(env.DB);
    const originalExpires = new Date(Date.now() + 30 * 86400000);
    await db.insert(grantsTable).values({
      id: 'gr-spx',
      orgId: org.id,
      type: 'single_project',
      startsAt: new Date(),
      expiresAt: originalExpires,
      createdAt: new Date(),
      revokedAt: null,
      stripeCheckoutSessionId: null,
      metadata: null,
    });

    const res = await grantSingleProjectHandler({
      request: new Request(`http://localhost/api/admin/orgs/${org.id}/grant-single-project`, {
        method: 'POST',
      }),
      params: { orgId: org.id },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { action: string; grant: { id: string } };
    expect(body.action).toBe('extended');
    expect(body.grant.id).toBe('gr-spx');

    const [row] = await db
      .select({ expiresAt: grantsTable.expiresAt })
      .from(grantsTable)
      .where(eq(grantsTable.id, 'gr-spx'));
    expect((row.expiresAt as Date).getTime()).toBeGreaterThan(originalExpires.getTime());
  });
});

void env;
void organization;
