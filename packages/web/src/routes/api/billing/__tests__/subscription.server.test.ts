import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, resetCounter } from '@/__tests__/server/factories';
import { handleGet } from '../subscription';

let sessionResult: {
  user: { id: string; email: string; name: string };
  session: { id: string; userId: string; activeOrganizationId: string | null };
} | null = null;

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => sessionResult,
}));

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs([]);
  vi.clearAllMocks();
  resetCounter();
  sessionResult = null;
});

function subReq(): Request {
  return new Request('http://localhost/api/billing/subscription', { method: 'GET' });
}

describe('GET /api/billing/subscription', () => {
  it('returns 401 when no session', async () => {
    const res = await handleGet({ request: subReq() });
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller has no org', async () => {
    sessionResult = {
      user: { id: 'orphan', email: 'o@example.com', name: 'O' },
      session: { id: 'sess', userId: 'orphan', activeOrganizationId: null },
    };
    const res = await handleGet({ request: subReq() });
    expect(res.status).toBe(403);
  });

  it('returns free tier when no subscription exists', async () => {
    const { org, owner } = await buildOrg();
    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess', userId: owner.id, activeOrganizationId: org.id },
    };
    const res = await handleGet({ request: subReq() });
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

    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess', userId: owner.id, activeOrganizationId: org.id },
    };
    const res = await handleGet({ request: subReq() });
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
