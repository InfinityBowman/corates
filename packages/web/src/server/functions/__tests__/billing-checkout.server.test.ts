import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { buildOrg, resetCounter } from '@/__tests__/server/factories';
import { createCheckout } from '@/server/functions/billing.server';
import type { Session } from '@/server/middleware/auth';
import { DomainErrorException } from '@corates/shared';

const upgradeSubscriptionMock = vi.fn();

vi.mock('@corates/workers/auth-config', () => ({
  createAuth: () => ({
    api: { upgradeSubscription: (...args: unknown[]) => upgradeSubscriptionMock(...args) },
  }),
}));

beforeEach(async () => {
  await resetTestDatabase();
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
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(400);
      const body = res.toDomainError() as { code: string };
      expect(body.code).toMatch(/VALIDATION/);
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
      await createCheckout(createDb(env.DB), session, dummyRequest, 'team', 'monthly');
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(400);
      const body = res.toDomainError() as { code: string; details?: { reason?: string } };
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

const stripeRetrieveMock = vi.fn();
const stripeUpdateMock = vi.fn();
const syncStripeSubscriptionMock = vi.fn();

vi.mock('@corates/shared/stripe', async importOriginal => ({
  ...(await importOriginal<typeof import('@corates/shared/stripe')>()),
  createStripeClient: () => ({
    subscriptions: {
      retrieve: (...args: unknown[]) => stripeRetrieveMock(...args),
      update: (...args: unknown[]) => stripeUpdateMock(...args),
    },
  }),
}));

vi.mock('@corates/workers/commands/billing', () => ({
  syncStripeSubscription: (...args: unknown[]) => syncStripeSubscriptionMock(...args),
}));

describe('createCheckout for an existing Stripe subscriber', () => {
  it('swaps the price on the subscription instead of opening checkout', async () => {
    const { org, owner } = await buildOrg();
    const { subscription } = await import('@corates/db/schema');
    const db = createDb(env.DB);
    await db.insert(subscription).values({
      id: 'sub-row',
      plan: 'team',
      referenceId: org.id,
      status: 'active',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      periodEnd: new Date(Date.now() + 86_400_000),
    });
    stripeRetrieveMock.mockResolvedValueOnce({ items: { data: [{ id: 'si_123' }] } });
    stripeUpdateMock.mockResolvedValueOnce({});
    syncStripeSubscriptionMock.mockResolvedValueOnce({ status: 'active' });

    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    const result = await createCheckout(db, session, dummyRequest, 'lab', 'yearly');

    expect((result as { url: string }).url).toContain('/settings/billing?success=true');
    expect(stripeUpdateMock).toHaveBeenCalledWith('sub_123', {
      items: [{ id: 'si_123', price: env.STRIPE_PRICE_ID_LAB_YEARLY }],
      proration_behavior: 'always_invoice',
    });
    expect(syncStripeSubscriptionMock).toHaveBeenCalledWith(expect.anything(), db, 'cus_123');
    expect(upgradeSubscriptionMock).not.toHaveBeenCalled();
  });
});
