import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { buildOrg, resetCounter } from '@/__tests__/server/factories';
import { createDb } from '@corates/db/client';
import { orgAccessGrants as grantsTable, subscription } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import type { OrgId, OrgAccessGrantId } from '@corates/shared/ids';
import type { Session } from '@/server/middleware/auth';
import {
  getAdminOrgBilling,
  createAdminSubscription,
  updateAdminSubscription,
  cancelAdminSubscription,
  createAdminGrant,
  updateAdminGrant,
  revokeAdminGrant,
  grantAdminTrial,
  grantAdminSingleProject,
} from '@/server/functions/admin-orgs.server';

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
});

function mockAdminSession(): Session {
  return {
    user: { id: 'admin-id', email: 'admin@example.com', name: 'Admin', role: 'admin' },
    session: { id: 'admin-sess', userId: 'admin-id' },
  } as Session;
}

describe('GET /api/admin/orgs/:orgId/billing', () => {
  it('throws 400 for non-existent org', async () => {
    try {
      await getAdminOrgBilling(mockAdminSession(), createDb(env.DB), 'missing' as OrgId);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }
  });

  it('returns billing snapshot with subscriptions + grants', async () => {
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

    const result = await getAdminOrgBilling(mockAdminSession(), createDb(env.DB), org.id as OrgId);
    expect(result.orgId).toBe(org.id);
    expect(result.billing.plan.name).toBeDefined();
    expect(result.subscriptions.find(s => s.id === 'sub-1')).toBeDefined();
    expect(result.grants.find(g => g.id === 'gr-1')).toBeDefined();
  });
});

describe('POST /api/admin/orgs/:orgId/subscriptions', () => {
  it('throws 400 for non-existent org', async () => {
    try {
      await createAdminSubscription(mockAdminSession(), createDb(env.DB), 'missing' as OrgId, {
        plan: 'team',
        status: 'active',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }
  });

  it('creates subscription and dispatches notify', async () => {
    const { org } = await buildOrg();
    const result = await createAdminSubscription(
      mockAdminSession(),
      createDb(env.DB),
      org.id as OrgId,
      {
        plan: 'team',
        status: 'active',
        stripeCustomerId: 'cus_1',
      },
    );
    expect(result.success).toBe(true);
    expect(result.subscription.plan).toBe('team');
    expect(result.subscription.referenceId).toBe(org.id);
    expect(mockNotifyOrgMembers).toHaveBeenCalledTimes(1);

    const db = createDb(env.DB);
    const rows = await db
      .select()
      .from(subscription)
      .where(eq(subscription.id, result.subscription.id));
    expect(rows.length).toBe(1);
  });
});

describe('PUT /api/admin/orgs/:orgId/subscriptions/:subscriptionId', () => {
  it('throws 400 for non-existent subscription', async () => {
    const { org } = await buildOrg();
    try {
      await updateAdminSubscription(mockAdminSession(), createDb(env.DB), org.id as OrgId, 'nope', {
        status: 'paused',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }
  });

  it('updates only provided fields and notifies', async () => {
    const { org } = await buildOrg();
    const db = createDb(env.DB);
    await db.insert(subscription).values({
      id: 'sub-upd',
      plan: 'team',
      referenceId: org.id,
      status: 'active',
      periodStart: new Date(),
      periodEnd: null,
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await updateAdminSubscription(
      mockAdminSession(),
      createDb(env.DB),
      org.id as OrgId,
      'sub-upd',
      { status: 'paused', cancelAtPeriodEnd: true },
    );
    expect(result.success).toBe(true);
    expect(result.subscription.status).toBe('paused');
    expect(result.subscription.cancelAtPeriodEnd).toBe(true);
    expect(result.subscription.plan).toBe('team');
    expect(mockNotifyOrgMembers).toHaveBeenCalledTimes(1);
  });
});

describe('DELETE /api/admin/orgs/:orgId/subscriptions/:subscriptionId', () => {
  it('throws 400 for non-existent subscription', async () => {
    const { org } = await buildOrg();
    try {
      await cancelAdminSubscription(mockAdminSession(), createDb(env.DB), org.id as OrgId, 'nope');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }
  });

  it('soft-cancels and notifies', async () => {
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

    await cancelAdminSubscription(mockAdminSession(), createDb(env.DB), org.id as OrgId, 'sub-del');

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
  it('throws 400 for non-existent org', async () => {
    const startsAt = new Date();
    const expiresAt = new Date(Date.now() + 86400000);
    try {
      await createAdminGrant(mockAdminSession(), createDb(env.DB), 'missing' as OrgId, {
        type: 'trial',
        startsAt,
        expiresAt,
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }
  });

  it('rejects second trial for same org', async () => {
    const { org } = await buildOrg();
    const startsAt = new Date();
    const expiresAt = new Date(Date.now() + 14 * 86400000);

    await createAdminGrant(mockAdminSession(), createDb(env.DB), org.id as OrgId, {
      type: 'trial',
      startsAt,
      expiresAt,
    });

    try {
      await createAdminGrant(mockAdminSession(), createDb(env.DB), org.id as OrgId, {
        type: 'trial',
        startsAt,
        expiresAt,
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }
  });

  it('rejects expiresAt <= startsAt', async () => {
    const { org } = await buildOrg();
    const ts = new Date();
    try {
      await createAdminGrant(mockAdminSession(), createDb(env.DB), org.id as OrgId, {
        type: 'single_project',
        startsAt: ts,
        expiresAt: ts,
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }
  });

  it('creates a single_project grant', async () => {
    const { org } = await buildOrg();
    const startsAt = new Date();
    const expiresAt = new Date(Date.now() + 30 * 86400000);
    const result = await createAdminGrant(mockAdminSession(), createDb(env.DB), org.id as OrgId, {
      type: 'single_project',
      startsAt,
      expiresAt,
    });
    expect(result.grant.type).toBe('single_project');
    expect(result.grant.orgId).toBe(org.id);
  });
});

describe('PUT /api/admin/orgs/:orgId/grants/:grantId', () => {
  it('throws 400 when no actionable fields', async () => {
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

    try {
      await updateAdminGrant(
        mockAdminSession(),
        createDb(env.DB),
        org.id as OrgId,
        'gr-empty' as OrgAccessGrantId,
        {},
      );
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }
  });

  it('updates expiresAt', async () => {
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
    const result = await updateAdminGrant(
      mockAdminSession(),
      createDb(env.DB),
      org.id as OrgId,
      'gr-ext' as OrgAccessGrantId,
      {
        expiresAt: newExpires,
      },
    );
    expect(result.success).toBe(true);
  });

  it('revokes and unrevokes', async () => {
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

    await updateAdminGrant(
      mockAdminSession(),
      createDb(env.DB),
      org.id as OrgId,
      'gr-rev' as OrgAccessGrantId,
      {
        revokedAt: new Date(),
      },
    );
    const [revoked] = await db
      .select({ revokedAt: grantsTable.revokedAt })
      .from(grantsTable)
      .where(eq(grantsTable.id, 'gr-rev'));
    expect(revoked.revokedAt).toBeInstanceOf(Date);

    await updateAdminGrant(
      mockAdminSession(),
      createDb(env.DB),
      org.id as OrgId,
      'gr-rev' as OrgAccessGrantId,
      {
        revokedAt: null,
      },
    );
    const [unrevoked] = await db
      .select({ revokedAt: grantsTable.revokedAt })
      .from(grantsTable)
      .where(eq(grantsTable.id, 'gr-rev'));
    expect(unrevoked.revokedAt).toBeNull();
  });
});

describe('DELETE /api/admin/orgs/:orgId/grants/:grantId', () => {
  it('throws 400 for non-existent grant', async () => {
    const { org } = await buildOrg();
    try {
      await revokeAdminGrant(
        mockAdminSession(),
        createDb(env.DB),
        org.id as OrgId,
        'nope' as OrgAccessGrantId,
      );
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }
  });

  it('revokes the grant', async () => {
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

    await revokeAdminGrant(
      mockAdminSession(),
      createDb(env.DB),
      org.id as OrgId,
      'gr-del' as OrgAccessGrantId,
    );

    const [row] = await db
      .select({ revokedAt: grantsTable.revokedAt })
      .from(grantsTable)
      .where(eq(grantsTable.id, 'gr-del'));
    expect(row.revokedAt).toBeInstanceOf(Date);
  });
});

describe('POST /api/admin/orgs/:orgId/grant-trial', () => {
  it('throws 400 for non-existent org', async () => {
    try {
      await grantAdminTrial(mockAdminSession(), createDb(env.DB), 'missing' as OrgId);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }
  });

  it('creates a 14-day trial', async () => {
    const { org } = await buildOrg();
    const result = await grantAdminTrial(mockAdminSession(), createDb(env.DB), org.id as OrgId);
    expect(result.success).toBe(true);
    expect(result.grant.type).toBe('trial');
    expect(result.grant.orgId).toBe(org.id);
  });

  it('rejects when trial already exists', async () => {
    const { org } = await buildOrg();
    await grantAdminTrial(mockAdminSession(), createDb(env.DB), org.id as OrgId);

    try {
      await grantAdminTrial(mockAdminSession(), createDb(env.DB), org.id as OrgId);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }
  });
});

describe('POST /api/admin/orgs/:orgId/grant-single-project', () => {
  it('throws 400 for non-existent org', async () => {
    try {
      await grantAdminSingleProject(mockAdminSession(), createDb(env.DB), 'missing' as OrgId);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }
  });

  it('creates a fresh grant when none exists', async () => {
    const { org } = await buildOrg();
    const result = await grantAdminSingleProject(
      mockAdminSession(),
      createDb(env.DB),
      org.id as OrgId,
    );
    expect(result.action).toBe('created');
    expect(result.grant.type).toBe('single_project');
  });

  it('extends existing non-revoked grant by 6 months', async () => {
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

    const result = await grantAdminSingleProject(
      mockAdminSession(),
      createDb(env.DB),
      org.id as OrgId,
    );
    expect(result.action).toBe('extended');
    expect(result.grant.id).toBe('gr-spx');

    const [row] = await db
      .select({ expiresAt: grantsTable.expiresAt })
      .from(grantsTable)
      .where(eq(grantsTable.id, 'gr-spx'));
    expect((row.expiresAt as Date).getTime()).toBeGreaterThan(originalExpires.getTime());
  });
});
