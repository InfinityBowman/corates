import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, buildOrgMember, resetCounter } from '@/__tests__/server/factories';
import { handlePost } from '../checkout';

let sessionResult: {
  user: { id: string; email: string; name: string };
  session: { id: string; userId: string; activeOrganizationId: string | null };
};

const upgradeSubscriptionMock = vi.fn();

vi.mock('@corates/workers/auth-config', () => ({
  createAuth: () => ({
    api: { upgradeSubscription: (...args: unknown[]) => upgradeSubscriptionMock(...args) },
  }),
}));

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs([]);
  vi.clearAllMocks();
  resetCounter();
});

function checkoutReq(body: unknown): Request {
  return new Request('http://localhost/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/billing/checkout', () => {
  it('returns 400 when tier is missing', async () => {
    sessionResult = {
      user: { id: 'u1', email: 'u@example.com', name: 'U' },
      session: { id: 'sess', userId: 'u1', activeOrganizationId: null },
    };
    const res = await handlePost({
      request: checkoutReq({ interval: 'monthly' }),
      context: { db: createDb(env.DB), session: sessionResult },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/VALIDATION/);
  });

  it('returns 400 when tier equals default plan (free)', async () => {
    const { org, owner } = await buildOrg();
    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess', userId: owner.id, activeOrganizationId: org.id },
    };
    const res = await handlePost({
      request: checkoutReq({ tier: 'free' }),
      context: { db: createDb(env.DB), session: sessionResult },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/VALIDATION/);
    expect(upgradeSubscriptionMock).not.toHaveBeenCalled();
  });

  it('returns 403 when caller is not org owner', async () => {
    const { org } = await buildOrg();
    const { user: memberUser } = await buildOrgMember({ orgId: org.id, role: 'member' });
    sessionResult = {
      user: { id: memberUser.id, email: memberUser.email, name: memberUser.name },
      session: { id: 'sess', userId: memberUser.id, activeOrganizationId: org.id },
    };
    const res = await handlePost({
      request: checkoutReq({ tier: 'team' }),
      context: { db: createDb(env.DB), session: sessionResult },
    });
    expect(res.status).toBe(403);
    expect(upgradeSubscriptionMock).not.toHaveBeenCalled();
  });

  it('returns 400 when downgrade exceeds quotas', async () => {
    const { org, owner } = await buildOrg();
    const { projects } = await import('@corates/db/schema');
    const { createDb } = await import('@corates/db/client');
    const db = createDb(env.DB);

    for (let i = 1; i <= 5; i++) {
      await db.insert(projects).values({
        id: `project-${i}`,
        name: `Project ${i}`,
        orgId: org.id,
        createdBy: owner.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess', userId: owner.id, activeOrganizationId: org.id },
    };
    const res = await handlePost({
      request: checkoutReq({ tier: 'starter_team' }),
      context: { db: createDb(env.DB), session: sessionResult },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.details?.reason).toBe('downgrade_exceeds_quotas');
    expect(upgradeSubscriptionMock).not.toHaveBeenCalled();
  });

  it('creates checkout session for valid tier', async () => {
    const { org, owner } = await buildOrg();
    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess', userId: owner.id, activeOrganizationId: org.id },
    };
    upgradeSubscriptionMock.mockResolvedValueOnce({ url: 'https://checkout.stripe/test' });

    const res = await handlePost({
      request: checkoutReq({ tier: 'team', interval: 'monthly' }),
      context: { db: createDb(env.DB), session: sessionResult },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string };
    expect(body.url).toBe('https://checkout.stripe/test');

    const callArg = upgradeSubscriptionMock.mock.calls[0][0] as {
      body: { plan: string; annual: boolean; referenceId: string };
    };
    expect(callArg.body.plan).toBe('team');
    expect(callArg.body.annual).toBe(false);
    expect(callArg.body.referenceId).toBe(org.id);
  });

  it('returns 500 when upgradeSubscription throws non-domain error', async () => {
    const { org, owner } = await buildOrg();
    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess', userId: owner.id, activeOrganizationId: org.id },
    };
    upgradeSubscriptionMock.mockRejectedValueOnce(new Error('Stripe API error'));

    const res = await handlePost({
      request: checkoutReq({ tier: 'team' }),
      context: { db: createDb(env.DB), session: sessionResult },
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('SYSTEM_INTERNAL_ERROR');
  });
});
