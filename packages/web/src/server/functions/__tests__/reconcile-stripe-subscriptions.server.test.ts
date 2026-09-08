import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { createDb } from '@corates/db/client';
import { subscription } from '@corates/db/schema';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { buildOrg, resetCounter } from '@/__tests__/server/factories';
import { reconcileStripeSubscriptions } from '@corates/workers/commands/billing';

const stripeListMock = vi.fn();
const stripeRetrieveMock = vi.fn();

vi.mock('@corates/shared/stripe', async importOriginal => ({
  ...(await importOriginal<typeof import('@corates/shared/stripe')>()),
  createStripeClient: () => ({
    subscriptions: {
      list: (...args: unknown[]) => stripeListMock(...args),
      retrieve: (...args: unknown[]) => stripeRetrieveMock(...args),
    },
  }),
}));

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  resetCounter();
});

const nowSec = Math.floor(Date.now() / 1000);

function stripeSub(id: string, orgId: string, customer: string, status = 'active') {
  return {
    id,
    status,
    customer,
    metadata: { referenceId: orgId },
    items: {
      data: [
        {
          price: { id: 'price_team_monthly', lookup_key: 'team_monthly' },
          current_period_start: nowSec,
          current_period_end: nowSec + 30 * 86_400,
        },
      ],
    },
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: null,
    ended_at: null,
    trial_start: null,
    trial_end: null,
  };
}

// The real client returns an async iterable that walks every page.
function stripeList(subs: unknown[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const sub of subs) yield sub;
    },
  };
}

async function insertRow(values: Partial<typeof subscription.$inferInsert> & { id: string }) {
  const db = createDb(env.DB);
  await db.insert(subscription).values({
    plan: 'team',
    referenceId: 'org',
    status: 'active',
    ...values,
  });
}

describe('reconcileStripeSubscriptions', () => {
  it('rewrites rows that drifted from Stripe and reports the change', async () => {
    const { org } = await buildOrg();
    await insertRow({
      id: 'row',
      referenceId: org.id,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      status: 'active',
    });
    stripeListMock.mockReturnValueOnce(
      stripeList([stripeSub('sub_1', org.id, 'cus_1', 'canceled')]),
    );

    const db = createDb(env.DB);
    const result = await reconcileStripeSubscriptions(env, db);

    expect(result).toEqual({ scanned: 1, changed: 1, orphaned: 0, failed: 0 });
    const row = await db.select().from(subscription).where(eq(subscription.id, 'row')).get();
    expect(row?.status).toBe('canceled');
  });

  it('leaves rows that already match untouched', async () => {
    const { org } = await buildOrg();
    await insertRow({
      id: 'row',
      referenceId: org.id,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
    });
    stripeListMock.mockReturnValueOnce(stripeList([stripeSub('sub_1', org.id, 'cus_1')]));

    const result = await reconcileStripeSubscriptions(env, createDb(env.DB));

    expect(result).toEqual({ scanned: 1, changed: 0, orphaned: 0, failed: 0 });
  });

  it('cancels a row whose subscription Stripe no longer has, after a direct read confirms it', async () => {
    const { org } = await buildOrg();
    await insertRow({
      id: 'gone',
      referenceId: org.id,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_gone',
    });
    stripeListMock.mockReturnValueOnce(stripeList([]));
    stripeRetrieveMock.mockRejectedValueOnce(
      Object.assign(new Error('No such subscription'), {
        code: 'resource_missing',
      }),
    );

    const db = createDb(env.DB);
    const result = await reconcileStripeSubscriptions(env, db);

    expect(stripeRetrieveMock).toHaveBeenCalledWith('sub_gone', { expand: ['items.data.price'] });
    expect(result).toEqual({ scanned: 0, changed: 1, orphaned: 1, failed: 0 });
    const row = await db.select().from(subscription).where(eq(subscription.id, 'gone')).get();
    expect(row?.status).toBe('canceled');
    expect(row?.endedAt).not.toBeNull();
  });

  it('keeps a row the list skipped when the direct read still finds it', async () => {
    const { org } = await buildOrg();
    await insertRow({
      id: 'row',
      referenceId: org.id,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
    });
    stripeListMock.mockReturnValueOnce(stripeList([]));
    stripeRetrieveMock.mockResolvedValueOnce(stripeSub('sub_1', org.id, 'cus_1'));

    const db = createDb(env.DB);
    const result = await reconcileStripeSubscriptions(env, db);

    expect(result).toEqual({ scanned: 0, changed: 0, orphaned: 0, failed: 0 });
    const row = await db.select().from(subscription).where(eq(subscription.id, 'row')).get();
    expect(row?.status).toBe('active');
  });

  it('never touches admin-provisioned rows with no Stripe subscription', async () => {
    const { org } = await buildOrg();
    await insertRow({ id: 'enterprise', referenceId: org.id, plan: 'enterprise' });
    stripeListMock.mockReturnValueOnce(stripeList([]));

    const db = createDb(env.DB);
    const result = await reconcileStripeSubscriptions(env, db);

    expect(stripeRetrieveMock).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 0, changed: 0, orphaned: 0, failed: 0 });
    const row = await db.select().from(subscription).where(eq(subscription.id, 'enterprise')).get();
    expect(row?.status).toBe('active');
  });

  it('counts a subscription whose sync throws and carries on', async () => {
    const { org: orgA } = await buildOrg();
    const { org: orgB } = await buildOrg();
    await insertRow({
      id: 'row-b',
      referenceId: orgB.id,
      stripeCustomerId: 'cus_b',
      stripeSubscriptionId: 'sub_b',
      status: 'past_due',
    });
    // A subscription with no org reference and no local row is skipped by the
    // sync, not thrown; force a throw with a malformed item instead.
    const broken = { ...stripeSub('sub_a', orgA.id, 'cus_a'), items: null };
    stripeListMock.mockReturnValueOnce(stripeList([broken, stripeSub('sub_b', orgB.id, 'cus_b')]));

    const db = createDb(env.DB);
    const result = await reconcileStripeSubscriptions(env, db);

    expect(result).toEqual({ scanned: 2, changed: 1, orphaned: 0, failed: 1 });
    const rowB = await db.select().from(subscription).where(eq(subscription.id, 'row-b')).get();
    expect(rowB?.status).toBe('active');
  });
});
