import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, buildOrgMember, resetCounter } from '@/__tests__/server/factories';
import { createCheckout } from '@/server/functions/billing.server';
import type { Session } from '@/server/middleware/auth';

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

function mockSession(overrides: {
  userId: string;
  email: string;
  name: string;
  activeOrganizationId?: string | null;
}): Session {
  return {
    user: { id: overrides.userId, email: overrides.email, name: overrides.name },
    session: {
      id: 'sess',
      userId: overrides.userId,
      activeOrganizationId: overrides.activeOrganizationId ?? null,
    },
  } as Session;
}

const dummyRequest = new Request('http://localhost/api/billing/checkout', { method: 'POST' });

describe('createCheckout', () => {
  it('returns 400 when tier equals default plan (free)', async () => {
    const { org, owner } = await buildOrg();
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    try {
      await createCheckout(createDb(env.DB), session, dummyRequest, 'free', 'monthly');
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toMatch(/VALIDATION/);
    }
    expect(upgradeSubscriptionMock).not.toHaveBeenCalled();
  });

  it('returns 403 when caller is not org owner', async () => {
    const { org } = await buildOrg();
    const { user: memberUser } = await buildOrgMember({ orgId: org.id, role: 'member' });
    const session = mockSession({
      userId: memberUser.id,
      email: memberUser.email,
      name: memberUser.name,
      activeOrganizationId: org.id,
    });
    try {
      await createCheckout(createDb(env.DB), session, dummyRequest, 'team', 'monthly');
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
    }
    expect(upgradeSubscriptionMock).not.toHaveBeenCalled();
  });

  it('returns 400 when downgrade exceeds quotas', async () => {
    const { org, owner } = await buildOrg();
    const { projects } = await import('@corates/db/schema');
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

    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    try {
      await createCheckout(createDb(env.DB), session, dummyRequest, 'starter_team', 'monthly');
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string; details?: { reason?: string } };
      expect(body.details?.reason).toBe('downgrade_exceeds_quotas');
    }
    expect(upgradeSubscriptionMock).not.toHaveBeenCalled();
  });

  it('creates checkout session for valid tier', async () => {
    const { org, owner } = await buildOrg();
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    upgradeSubscriptionMock.mockResolvedValueOnce({ url: 'https://checkout.stripe/test' });

    const result = await createCheckout(createDb(env.DB), session, dummyRequest, 'team', 'monthly');
    expect((result as { url: string }).url).toBe('https://checkout.stripe/test');

    const callArg = upgradeSubscriptionMock.mock.calls[0][0] as {
      body: { plan: string; annual: boolean; referenceId: string };
    };
    expect(callArg.body.plan).toBe('team');
    expect(callArg.body.annual).toBe(false);
    expect(callArg.body.referenceId).toBe(org.id);
  });

  it('propagates error when upgradeSubscription throws', async () => {
    const { org, owner } = await buildOrg();
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    upgradeSubscriptionMock.mockRejectedValueOnce(new Error('Stripe API error'));

    await expect(
      createCheckout(createDb(env.DB), session, dummyRequest, 'team', 'monthly'),
    ).rejects.toThrow('Stripe API error');
  });
});
