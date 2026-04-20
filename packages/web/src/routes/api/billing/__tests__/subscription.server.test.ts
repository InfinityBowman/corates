import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, resetCounter } from '@/__tests__/server/factories';
import { fetchSubscription } from '@/server/functions/billing.server';
import type { Session } from '@/server/middleware/auth';

function mockSession(overrides?: {
  userId?: string;
  email?: string;
  name?: string;
  activeOrganizationId?: string | null;
}): Session {
  return {
    user: {
      id: overrides?.userId ?? 'user-1',
      email: overrides?.email ?? 'user@example.com',
      name: overrides?.name ?? 'Test User',
    },
    session: {
      id: 'sess-1',
      userId: overrides?.userId ?? 'user-1',
      activeOrganizationId: overrides?.activeOrganizationId ?? null,
    },
  } as Session;
}

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs([]);
  resetCounter();
});

describe('fetchSubscription', () => {
  it('throws 403 when caller has no org', async () => {
    const session = mockSession({ userId: 'orphan', email: 'o@example.com', name: 'O' });
    try {
      await fetchSubscription(createDb(env.DB), session);
      expect.fail('should have thrown');
    } catch (res) {
      expect((res as Response).status).toBe(403);
    }
  });

  it('returns free tier when no subscription exists', async () => {
    const { org, owner } = await buildOrg();
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    const result = await fetchSubscription(createDb(env.DB), session);
    expect(result.tier).toBe('free');
    expect(result.status).toBe('inactive');
    expect(result.stripeSubscriptionId).toBeNull();
    expect(result.source).toBe('free');
    expect(result.accessMode).toBe('free');
    expect(result.projectCount).toBe(0);
  });

  it('returns active subscription when one exists', async () => {
    const { org, owner } = await buildOrg();
    const { subscription, projects } = await import('@corates/db/schema');
    const db = createDb(env.DB);

    const nowSec = Math.floor(Date.now() / 1000);
    await db.insert(subscription).values({
      id: 'sub-1',
      plan: 'team',
      referenceId: org.id,
      status: 'active',
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
      periodStart: new Date(nowSec * 1000),
      periodEnd: new Date((nowSec + 86400 * 30) * 1000),
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(projects).values({
      id: 'project-1',
      name: 'P',
      orgId: org.id,
      createdBy: owner.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    const result = await fetchSubscription(createDb(env.DB), session);
    expect(result.tier).toBe('team');
    expect(result.status).toBe('active');
    expect(result.stripeSubscriptionId).toBe('sub-1');
    expect(result.source).toBe('subscription');
    expect(result.accessMode).toBe('full');
    expect(result.projectCount).toBe(1);
    expect(result.currentPeriodEnd).toBeGreaterThan(nowSec);
  });
});
