import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, resetCounter } from '@/__tests__/server/factories';
import { handleGet } from '../invoices';

let sessionResult: {
  user: { id: string; email: string; name: string };
  session: { id: string; userId: string; activeOrganizationId: string | null };
} | null = null;

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => sessionResult,
}));

const invoicesListMock = vi.fn();

vi.mock('@corates/workers/stripe', () => ({
  createStripeClient: () => ({
    invoices: { list: (...args: unknown[]) => invoicesListMock(...args) },
  }),
}));

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs([]);
  vi.clearAllMocks();
  resetCounter();
  sessionResult = null;
});

function invoicesReq(): Request {
  return new Request('http://localhost/api/billing/invoices', { method: 'GET' });
}

async function seedSubscription(orgId: string, customerId: string, status = 'active') {
  const { subscription } = await import('@corates/db/schema');
  const { createDb } = await import('@corates/db/client');
  const db = createDb(env.DB);
  await db.insert(subscription).values({
    id: `sub-${orgId}`,
    plan: 'team',
    referenceId: orgId,
    status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: 'sub_test',
    periodStart: new Date(),
    periodEnd: new Date(Date.now() + 86400 * 30 * 1000),
    cancelAtPeriodEnd: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('GET /api/billing/invoices', () => {
  it('returns 401 when no session', async () => {
    const res = await handleGet({ request: invoicesReq(), context: { db: createDb(env.DB) } });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('AUTH_REQUIRED');
  });

  it('returns 403 when caller has no org', async () => {
    sessionResult = {
      user: { id: 'orphan-user', email: 'orphan@example.com', name: 'Orphan' },
      session: { id: 'sess-1', userId: 'orphan-user', activeOrganizationId: null },
    };
    const res = await handleGet({ request: invoicesReq(), context: { db: createDb(env.DB) } });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('no_org_found');
  });

  it('returns empty invoices when org has no active subscription', async () => {
    const { org, owner } = await buildOrg();
    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess-1', userId: owner.id, activeOrganizationId: org.id },
    };
    const res = await handleGet({ request: invoicesReq(), context: { db: createDb(env.DB) } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { invoices: unknown[] };
    expect(body.invoices).toEqual([]);
    expect(invoicesListMock).not.toHaveBeenCalled();
  });

  it('returns mapped invoices when subscription exists', async () => {
    const { org, owner } = await buildOrg();
    await seedSubscription(org.id, 'cus_real');
    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess-1', userId: owner.id, activeOrganizationId: org.id },
    };
    invoicesListMock.mockResolvedValueOnce({
      data: [
        {
          id: 'in_1',
          number: 'INV-001',
          amount_paid: 2900,
          currency: 'usd',
          status: 'paid',
          created: 1700000000,
          period_start: 1690000000,
          period_end: 1692500000,
          invoice_pdf: 'https://stripe.example/in_1.pdf',
          hosted_invoice_url: 'https://stripe.example/in_1',
        },
      ],
    });

    const res = await handleGet({ request: invoicesReq(), context: { db: createDb(env.DB) } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      invoices: Array<{
        id: string;
        number: string | null;
        amount: number;
        status: string | null;
        pdfUrl: string | null;
      }>;
    };
    expect(body.invoices).toHaveLength(1);
    expect(body.invoices[0].id).toBe('in_1');
    expect(body.invoices[0].amount).toBe(29);
    expect(body.invoices[0].status).toBe('paid');
    expect(body.invoices[0].pdfUrl).toBe('https://stripe.example/in_1.pdf');

    expect(invoicesListMock).toHaveBeenCalledTimes(1);
    const callArg = invoicesListMock.mock.calls[0][0] as { customer: string; limit: number };
    expect(callArg.customer).toBe('cus_real');
    expect(callArg.limit).toBe(10);
  });

  it('returns 500 when stripe.invoices.list throws', async () => {
    const { org, owner } = await buildOrg();
    await seedSubscription(org.id, 'cus_real');
    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess-1', userId: owner.id, activeOrganizationId: org.id },
    };
    invoicesListMock.mockRejectedValueOnce(new Error('stripe down'));

    const res = await handleGet({ request: invoicesReq(), context: { db: createDb(env.DB) } });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code: string; details?: { operation?: string } };
    expect(body.code).toBe('SYSTEM_INTERNAL_ERROR');
    expect(body.details?.operation).toBe('fetch_invoices');
  });
});
