import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedProject,
  seedStripeEventLedger,
} from '@/__tests__/server/helpers';
import { buildAdminUser, resetCounter } from '@/__tests__/server/factories';
import type { Session } from '@/server/middleware/auth';
import {
  getAdminSignupStats,
  getAdminOrgStats,
  getAdminProjectStats,
  getAdminWebhookStats,
  getAdminSubscriptionStats,
  getAdminRevenueStats,
} from '@/server/functions/admin-stats.server';

const subscriptionsSearchMock = vi.fn();
const invoicesListMock = vi.fn();

vi.mock('@corates/workers/stripe', () => ({
  createStripeClient: () => ({
    subscriptions: { search: (...args: unknown[]) => subscriptionsSearchMock(...args) },
    invoices: { list: (...args: unknown[]) => invoicesListMock(...args) },
  }),
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

describe('getAdminSignupStats', () => {
  it('returns daily counts with zero-fill', async () => {
    const todaySec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'signup-u1',
      name: 'A',
      email: 'a@example.com',
      createdAt: todaySec,
      updatedAt: todaySec,
    });

    const result = await getAdminSignupStats(mockAdminSession(), createDb(env.DB), { days: 7 });
    expect(result.days).toBe(7);
    expect(result.data.length).toBe(7);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it('caps days at 90', async () => {
    const result = await getAdminSignupStats(mockAdminSession(), createDb(env.DB), { days: 500 });
    expect(result.days).toBe(90);
    expect(result.data.length).toBe(90);
  });
});

describe('getAdminOrgStats', () => {
  it('returns daily org counts', async () => {
    const todaySec = Math.floor(Date.now() / 1000);
    await seedOrganization({
      id: 'orgstats-1',
      name: 'Org',
      slug: 'org',
      createdAt: todaySec,
    });

    const result = await getAdminOrgStats(mockAdminSession(), createDb(env.DB), { days: 5 });
    expect(result.days).toBe(5);
    expect(result.data.length).toBe(5);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });
});

describe('getAdminProjectStats', () => {
  it('returns daily project counts', async () => {
    const admin = await buildAdminUser();
    const todaySec = Math.floor(Date.now() / 1000);
    await seedOrganization({
      id: 'projstats-org',
      name: 'PS',
      slug: 'ps',
      createdAt: todaySec,
    });
    await seedProject({
      id: 'projstats-1',
      name: 'P',
      orgId: 'projstats-org',
      createdBy: admin.id,
      createdAt: todaySec,
      updatedAt: todaySec,
    });

    const result = await getAdminProjectStats(mockAdminSession(), createDb(env.DB), { days: 3 });
    expect(result.data.length).toBe(3);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });
});

describe('getAdminWebhookStats', () => {
  it('groups events into success/failed/pending by date', async () => {
    const todaySec = Math.floor(Date.now() / 1000);
    await seedStripeEventLedger({
      id: 'led-ok',
      payloadHash: 'hash-ok',
      route: '/webhooks/stripe',
      requestId: 'req-ok',
      receivedAt: todaySec,
      processedAt: todaySec,
      status: 'processed',
      stripeEventId: 'evt_ok',
      type: 'invoice.paid',
    });
    await seedStripeEventLedger({
      id: 'led-fail',
      payloadHash: 'hash-fail',
      route: '/webhooks/stripe',
      requestId: 'req-fail',
      receivedAt: todaySec,
      processedAt: todaySec,
      status: 'failed',
      stripeEventId: 'evt_fail',
      type: 'invoice.payment_failed',
    });
    await seedStripeEventLedger({
      id: 'led-pending',
      payloadHash: 'hash-pending',
      route: '/webhooks/stripe',
      requestId: 'req-pending',
      receivedAt: todaySec,
      processedAt: todaySec,
      status: 'received',
      stripeEventId: 'evt_pending',
      type: 'customer.created',
    });

    const result = await getAdminWebhookStats(mockAdminSession(), createDb(env.DB), { days: 3 });
    expect(result.days).toBe(3);
    expect(result.totals.success).toBeGreaterThanOrEqual(1);
    expect(result.totals.failed).toBeGreaterThanOrEqual(1);
    expect(result.totals.pending).toBeGreaterThanOrEqual(1);
  });

  it('caps days at 30', async () => {
    const result = await getAdminWebhookStats(mockAdminSession(), createDb(env.DB), { days: 200 });
    expect(result.days).toBe(30);
    expect(result.data.length).toBe(30);
  });
});

describe('getAdminSubscriptionStats', () => {
  it('returns counts from Stripe search', async () => {
    subscriptionsSearchMock
      .mockResolvedValueOnce({ data: [{}, {}, {}], has_more: false })
      .mockResolvedValueOnce({ data: [{}], has_more: false })
      .mockResolvedValueOnce({ data: [], has_more: false })
      .mockResolvedValueOnce({ data: [{}, {}], has_more: true });

    const result = await getAdminSubscriptionStats(mockAdminSession());
    expect(result.active).toBe(3);
    expect(result.trialing).toBe(1);
    expect(result.pastDue).toBe(0);
    expect(result.canceled).toBe(2);
    expect(result.hasMore).toBe(true);
  });

  it('throws when Stripe throws', async () => {
    subscriptionsSearchMock.mockRejectedValueOnce(new Error('stripe down'));
    await expect(getAdminSubscriptionStats(mockAdminSession())).rejects.toThrow('stripe down');
  });
});

describe('getAdminRevenueStats', () => {
  it('aggregates paid invoices by month with zero-fill', async () => {
    const now = Date.now();
    const oneMonthAgo = Math.floor((now - 30 * 24 * 60 * 60 * 1000) / 1000);
    invoicesListMock.mockResolvedValueOnce({
      data: [
        { created: Math.floor(now / 1000), amount_paid: 5000 },
        { created: oneMonthAgo, amount_paid: 2000 },
      ],
    });

    const result = await getAdminRevenueStats(mockAdminSession(), { months: 3 });
    expect(result.months).toBe(3);
    expect(result.data.length).toBe(3);
    expect(result.total).toBe(7000);
    expect(result.currency).toBe('usd');
  });

  it('caps months at 12', async () => {
    invoicesListMock.mockResolvedValueOnce({ data: [] });
    const result = await getAdminRevenueStats(mockAdminSession(), { months: 99 });
    expect(result.months).toBe(12);
    expect(result.data.length).toBe(12);
  });
});
