import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, resetCounter } from '@/__tests__/server/factories';
import { handleGet } from '../subscription';
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

function subReq(): Request {
  return new Request('http://localhost/api/billing/subscription', { method: 'GET' });
}

describe('GET /api/billing/subscription', () => {
  it('returns 403 when caller has no org', async () => {
    const session = mockSession({ userId: 'orphan', email: 'o@example.com', name: 'O' });
    const res = await handleGet({ request: subReq(), context: { db: createDb(env.DB), session } });
    expect(res.status).toBe(403);
  });

  it('returns free tier when no subscription exists', async () => {
    const { org, owner } = await buildOrg();
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    const res = await handleGet({ request: subReq(), context: { db: createDb(env.DB), session } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tier: string;
      status: string;
      stripeSubscriptionId: string | null;
      source: string;
      accessMode: string;
      projectCount: number;
    };
    expect(body.tier).toBe('free');
    expect(body.status).toBe('inactive');
    expect(body.stripeSubscriptionId).toBeNull();
    expect(body.source).toBe('free');
    expect(body.accessMode).toBe('free');
    expect(body.projectCount).toBe(0);
  });

  it('returns active subscription when one exists', async () => {
    const { org, owner } = await buildOrg();
    const { subscription, projects } = await import('@corates/db/schema');
    const { createDb } = await import('@corates/db/client');
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
    const res = await handleGet({ request: subReq(), context: { db: createDb(env.DB), session } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tier: string;
      status: string;
      stripeSubscriptionId: string | null;
      source: string;
      accessMode: string;
      projectCount: number;
      currentPeriodEnd: number | null;
    };
    expect(body.tier).toBe('team');
    expect(body.status).toBe('active');
    expect(body.stripeSubscriptionId).toBe('sub-1');
    expect(body.source).toBe('subscription');
    expect(body.accessMode).toBe('full');
    expect(body.projectCount).toBe(1);
    expect(body.currentPeriodEnd).toBeGreaterThan(nowSec);
  });
});
