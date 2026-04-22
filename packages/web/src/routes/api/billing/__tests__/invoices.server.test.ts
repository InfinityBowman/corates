import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, resetCounter } from '@/__tests__/server/factories';
import { fetchInvoices } from '@/server/functions/billing.server';
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
});

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

describe('fetchInvoices', () => {
  it('throws 403 when caller has no org', async () => {
    const session = mockSession({
      userId: 'orphan-user',
      email: 'orphan@example.com',
      name: 'Orphan',
    });
    try {
      await fetchInvoices(createDb(env.DB), session);
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      const body = (await res.json()) as { code: string; details?: { reason?: string } };
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('no_org_found');
    }
  });

  it('returns empty invoices when org has no active subscription', async () => {
    const { org, owner } = await buildOrg();
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    const result = await fetchInvoices(createDb(env.DB), session);
    expect(result.invoices).toEqual([]);
    expect(invoicesListMock).not.toHaveBeenCalled();
  });

  it('returns mapped invoices when subscription exists', async () => {
    const { org, owner } = await buildOrg();
    await seedSubscription(org.id, 'cus_real');
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
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

    const result = await fetchInvoices(createDb(env.DB), session);
    expect(result.invoices).toHaveLength(1);
    expect(result.invoices[0].id).toBe('in_1');
    expect(result.invoices[0].amount).toBe(29);
    expect(result.invoices[0].status).toBe('paid');
    expect(result.invoices[0].pdfUrl).toBe('https://stripe.example/in_1.pdf');

    expect(invoicesListMock).toHaveBeenCalledTimes(1);
    const callArg = invoicesListMock.mock.calls[0][0] as { customer: string; limit: number };
    expect(callArg.customer).toBe('cus_real');
    expect(callArg.limit).toBe(10);
  });

  it('propagates error when stripe.invoices.list throws', async () => {
    const { org, owner } = await buildOrg();
    await seedSubscription(org.id, 'cus_real');
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    invoicesListMock.mockRejectedValueOnce(new Error('stripe down'));

    await expect(fetchInvoices(createDb(env.DB), session)).rejects.toThrow('stripe down');
  });
});
