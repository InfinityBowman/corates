import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { createDb } from '@corates/db/client';
import { subscription } from '@corates/db/schema';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { buildOrg, resetCounter } from '@/__tests__/server/factories';
import { syncStripeSubscription } from '@corates/workers/commands/billing';

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

function stripeSub(id: string, orgId: string, lookupKey = 'team_monthly') {
  return {
    id,
    status: 'active',
    metadata: { referenceId: orgId },
    items: {
      data: [
        {
          price: { id: `price_${lookupKey}`, lookup_key: lookupKey },
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

async function insertRow(values: Partial<typeof subscription.$inferInsert> & { id: string }) {
  const db = createDb(env.DB);
  await db.insert(subscription).values({
    plan: 'team',
    referenceId: 'org',
    status: 'active',
    ...values,
  });
}

describe('syncStripeSubscription', () => {
  it('fills in the placeholder row Better Auth created at checkout', async () => {
    const { org } = await buildOrg();
    await insertRow({ id: 'placeholder', referenceId: org.id, status: 'incomplete' });
    stripeListMock.mockResolvedValueOnce({ data: [stripeSub('sub_new', org.id)] });

    const db = createDb(env.DB);
    const result = await syncStripeSubscription(env, db, 'cus_1');

    expect(result).toEqual({ status: 'active', stripeSubscriptionId: 'sub_new' });
    const rows = await db.select().from(subscription).all();
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe('placeholder');
    expect(rows[0].status).toBe('active');
    expect(rows[0].stripeSubscriptionId).toBe('sub_new');
    expect(rows[0].stripeCustomerId).toBe('cus_1');
  });

  it('syncs the named subscription without touching another workspace on the same customer', async () => {
    const { org: orgA } = await buildOrg();
    const { org: orgB } = await buildOrg();
    await insertRow({
      id: 'row-a',
      referenceId: orgA.id,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_a',
      createdAt: new Date(Date.now() - 1000),
    });
    await insertRow({
      id: 'row-b',
      referenceId: orgB.id,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_b',
    });
    stripeRetrieveMock.mockResolvedValueOnce(stripeSub('sub_a', orgA.id, 'lab_yearly'));

    const db = createDb(env.DB);
    await syncStripeSubscription(env, db, 'cus_1', 'sub_a');

    expect(stripeListMock).not.toHaveBeenCalled();
    const rowA = await db.select().from(subscription).where(eq(subscription.id, 'row-a')).get();
    const rowB = await db.select().from(subscription).where(eq(subscription.id, 'row-b')).get();
    expect(rowA?.plan).toBe('lab');
    expect(rowA?.referenceId).toBe(orgA.id);
    expect(rowB?.plan).toBe('team');
    expect(rowB?.referenceId).toBe(orgB.id);
  });

  it('cancels every open row for a customer with no subscriptions left in Stripe', async () => {
    const { org: orgA } = await buildOrg();
    const { org: orgB } = await buildOrg();
    await insertRow({ id: 'row-a', referenceId: orgA.id, stripeCustomerId: 'cus_1' });
    await insertRow({
      id: 'row-b',
      referenceId: orgB.id,
      stripeCustomerId: 'cus_1',
      status: 'past_due',
    });
    stripeListMock.mockResolvedValueOnce({ data: [] });

    const db = createDb(env.DB);
    const result = await syncStripeSubscription(env, db, 'cus_1');

    expect(result).toEqual({ status: 'none', stripeSubscriptionId: null });
    const rows = await db.select().from(subscription).all();
    expect(rows.map(r => r.status)).toEqual(['canceled', 'canceled']);
  });
});
