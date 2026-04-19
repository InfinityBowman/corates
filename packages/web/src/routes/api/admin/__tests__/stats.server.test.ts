import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedProject,
  seedStripeEventLedger,
} from '@/__tests__/server/helpers';
import { buildAdminUser, resetCounter } from '@/__tests__/server/factories';
import { handleGet as signupsGet } from '../stats/signups';
import { handleGet as orgsGet } from '../stats/organizations';
import { handleGet as projectsGet } from '../stats/projects';
import { handleGet as webhooksGet } from '../stats/webhooks';
import { handleGet as subsGet } from '../stats/subscriptions';
import { handleGet as revenueGet } from '../stats/revenue';

let sessionResult: {
  user: { id: string; email: string; name: string; role?: string };
  session: { id: string; userId: string; activeOrganizationId: string | null };
} | null = null;

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => sessionResult,
}));

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
  sessionResult = null;
});

async function asAdmin() {
  const admin = await buildAdminUser();
  sessionResult = {
    user: { id: admin.id, email: admin.email, name: admin.name, role: 'admin' },
    session: { id: 'admin-sess', userId: admin.id, activeOrganizationId: null },
  };
  return admin;
}

function req(path: string): Request {
  return new Request(`http://localhost${path}`);
}

describe('GET /api/admin/stats/signups', () => {
  it('returns daily counts with zero-fill', async () => {
    await asAdmin();
    const todaySec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'signup-u1',
      name: 'A',
      email: 'a@example.com',
      createdAt: todaySec,
      updatedAt: todaySec,
    });

    const res = await signupsGet({ request: req('/api/admin/stats/signups?days=7') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { date: string; count: number }[];
      total: number;
      days: number;
    };
    expect(body.days).toBe(7);
    expect(body.data.length).toBe(7);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it('caps days at 90', async () => {
    await asAdmin();
    const res = await signupsGet({ request: req('/api/admin/stats/signups?days=500') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { days: number; data: unknown[] };
    expect(body.days).toBe(90);
    expect(body.data.length).toBe(90);
  });
});

describe('GET /api/admin/stats/organizations', () => {
  it('returns daily org counts', async () => {
    await asAdmin();
    const todaySec = Math.floor(Date.now() / 1000);
    await seedOrganization({
      id: 'orgstats-1',
      name: 'Org',
      slug: 'org',
      createdAt: todaySec,
    });

    const res = await orgsGet({ request: req('/api/admin/stats/organizations?days=5') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; total: number; days: number };
    expect(body.days).toBe(5);
    expect(body.data.length).toBe(5);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/admin/stats/projects', () => {
  it('returns daily project counts', async () => {
    const admin = await asAdmin();
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

    const res = await projectsGet({ request: req('/api/admin/stats/projects?days=3') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; total: number };
    expect(body.data.length).toBe(3);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/admin/stats/webhooks', () => {
  it('groups events into success/failed/pending by date', async () => {
    await asAdmin();
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

    const res = await webhooksGet({ request: req('/api/admin/stats/webhooks?days=3') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { success: number; failed: number; pending: number }[];
      totals: { success: number; failed: number; pending: number };
      days: number;
    };
    expect(body.days).toBe(3);
    expect(body.totals.success).toBeGreaterThanOrEqual(1);
    expect(body.totals.failed).toBeGreaterThanOrEqual(1);
    expect(body.totals.pending).toBeGreaterThanOrEqual(1);
  });

  it('caps days at 30', async () => {
    await asAdmin();
    const res = await webhooksGet({ request: req('/api/admin/stats/webhooks?days=200') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { days: number; data: unknown[] };
    expect(body.days).toBe(30);
    expect(body.data.length).toBe(30);
  });
});

describe('GET /api/admin/stats/subscriptions', () => {
  it('returns counts from Stripe search', async () => {
    await asAdmin();
    subscriptionsSearchMock
      .mockResolvedValueOnce({ data: [{}, {}, {}], has_more: false })
      .mockResolvedValueOnce({ data: [{}], has_more: false })
      .mockResolvedValueOnce({ data: [], has_more: false })
      .mockResolvedValueOnce({ data: [{}, {}], has_more: true });

    const res = await subsGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      active: number;
      trialing: number;
      pastDue: number;
      canceled: number;
      hasMore: boolean;
    };
    expect(body.active).toBe(3);
    expect(body.trialing).toBe(1);
    expect(body.pastDue).toBe(0);
    expect(body.canceled).toBe(2);
    expect(body.hasMore).toBe(true);
  });

  it('returns 500 when Stripe throws', async () => {
    await asAdmin();
    subscriptionsSearchMock.mockRejectedValueOnce(new Error('stripe down'));
    const res = await subsGet();
    expect(res.status).toBe(500);
  });
});

describe('GET /api/admin/stats/revenue', () => {
  it('aggregates paid invoices by month with zero-fill', async () => {
    await asAdmin();
    const now = Date.now();
    const oneMonthAgo = Math.floor((now - 30 * 24 * 60 * 60 * 1000) / 1000);
    invoicesListMock.mockResolvedValueOnce({
      data: [
        { created: Math.floor(now / 1000), amount_paid: 5000 },
        { created: oneMonthAgo, amount_paid: 2000 },
      ],
    });

    const res = await revenueGet({ request: req('/api/admin/stats/revenue?months=3') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { month: string; revenue: number }[];
      total: number;
      currency: string;
      months: number;
    };
    expect(body.months).toBe(3);
    expect(body.data.length).toBe(3);
    expect(body.total).toBe(7000);
    expect(body.currency).toBe('usd');
  });

  it('caps months at 12', async () => {
    await asAdmin();
    invoicesListMock.mockResolvedValueOnce({ data: [] });
    const res = await revenueGet({ request: req('/api/admin/stats/revenue?months=99') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { months: number; data: unknown[] };
    expect(body.months).toBe(12);
    expect(body.data.length).toBe(12);
  });
});
