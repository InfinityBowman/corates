/**
 * Admin Stripe tools tests.
 *
 * Tests invoke the pure business logic functions in admin-stripe.server.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, seedSubscription } from '@/__tests__/server/helpers';
import { buildOrg, resetCounter } from '@/__tests__/server/factories';
import type { Session } from '@/server/middleware/auth';
import {
  lookupAdminStripeCustomer,
  createAdminStripePortalLink,
  getAdminStripeCustomerInvoices,
  getAdminStripeCustomerPaymentMethods,
  getAdminStripeCustomerSubscriptions,
} from '@/server/functions/admin-stripe.server';

const customersRetrieveMock = vi.fn();
const customersListMock = vi.fn();
const portalSessionsCreateMock = vi.fn();
const invoicesListMock = vi.fn();
const paymentMethodsListMock = vi.fn();
const subscriptionsListMock = vi.fn();

vi.mock('@corates/workers/stripe', () => ({
  createStripeClient: () => ({
    customers: {
      retrieve: (...args: unknown[]) => customersRetrieveMock(...args),
      list: (...args: unknown[]) => customersListMock(...args),
    },
    billingPortal: {
      sessions: { create: (...args: unknown[]) => portalSessionsCreateMock(...args) },
    },
    invoices: { list: (...args: unknown[]) => invoicesListMock(...args) },
    paymentMethods: { list: (...args: unknown[]) => paymentMethodsListMock(...args) },
    subscriptions: { list: (...args: unknown[]) => subscriptionsListMock(...args) },
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

describe('lookupAdminStripeCustomer', () => {
  it('throws 400 when neither email nor customerId provided', async () => {
    try {
      await lookupAdminStripeCustomer(mockAdminSession(), createDb(env.DB), {});
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }
  });

  it('returns found:false for deleted customer', async () => {
    customersRetrieveMock.mockResolvedValueOnce({ id: 'cus_x', deleted: true });
    const result = await lookupAdminStripeCustomer(mockAdminSession(), createDb(env.DB), {
      customerId: 'cus_x',
    });
    expect(result.found).toBe(false);
    expect(result.message).toMatch(/deleted/i);
  });

  it('returns found:false for missing customer id', async () => {
    customersRetrieveMock.mockRejectedValueOnce(
      Object.assign(new Error('not found'), { code: 'resource_missing' }),
    );
    const result = await lookupAdminStripeCustomer(mockAdminSession(), createDb(env.DB), {
      customerId: 'cus_missing',
    });
    expect(result.found).toBe(false);
  });

  it('returns found:false when email has no Stripe match', async () => {
    customersListMock.mockResolvedValueOnce({ data: [] });
    const result = await lookupAdminStripeCustomer(mockAdminSession(), createDb(env.DB), {
      email: 'nobody@example.com',
    });
    expect(result.found).toBe(false);
  });

  it('returns customer with linked org from subscription table', async () => {
    const { org } = await buildOrg();
    await seedSubscription({
      id: 'sub-link',
      plan: 'team',
      referenceId: org.id,
      status: 'active',
      stripeCustomerId: 'cus_linked',
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    });

    customersRetrieveMock.mockResolvedValueOnce({
      id: 'cus_linked',
      email: 'cust@example.com',
      name: 'Cust',
      phone: null,
      created: 1700000000,
      currency: 'usd',
      default_source: null,
      invoice_prefix: 'CUST',
      balance: 0,
      delinquent: false,
      metadata: {},
      livemode: false,
    });

    const result = await lookupAdminStripeCustomer(mockAdminSession(), createDb(env.DB), {
      customerId: 'cus_linked',
    });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.customer.id).toBe('cus_linked');
      expect(result.linkedOrg?.id).toBe(org.id);
      expect(result.stripeDashboardUrl).toContain('cus_linked');
    }
  });
});

describe('createAdminStripePortalLink', () => {
  it('creates a portal session and returns URL', async () => {
    portalSessionsCreateMock.mockResolvedValueOnce({
      url: 'https://billing.stripe.com/sess_admin',
      created: 1700000000,
    });
    const result = await createAdminStripePortalLink(mockAdminSession(), {
      customerId: 'cus_admin',
    });
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://billing.stripe.com/sess_admin');
    expect(result.expiresAt).toBe(1700000000 + 300);
    expect(portalSessionsCreateMock).toHaveBeenCalledWith({
      customer: 'cus_admin',
      return_url: expect.any(String),
    });
  });
});

describe('getAdminStripeCustomerInvoices', () => {
  it('returns invoice list mapped to API shape', async () => {
    invoicesListMock.mockResolvedValueOnce({
      data: [
        {
          id: 'in_1',
          number: 'INV-1',
          status: 'paid',
          currency: 'usd',
          amount_due: 0,
          amount_paid: 5000,
          amount_remaining: 0,
          total: 5000,
          subtotal: 5000,
          created: 1700000000,
          due_date: null,
          status_transitions: { paid_at: 1700000050 },
          hosted_invoice_url: 'https://stripe/inv',
          invoice_pdf: 'https://stripe/inv.pdf',
          subscription: 'sub_1',
          period_start: 1699000000,
          period_end: 1701000000,
        },
      ],
      has_more: false,
    });
    const result = await getAdminStripeCustomerInvoices(mockAdminSession(), {
      customerId: 'cus_x',
      limit: 5,
    });
    expect(result.customerId).toBe('cus_x');
    expect(result.invoices.length).toBe(1);
    expect(result.invoices[0].id).toBe('in_1');
    expect(result.invoices[0].subscriptionId).toBe('sub_1');
    expect(result.hasMore).toBe(false);
    expect(invoicesListMock).toHaveBeenCalledWith({ customer: 'cus_x', limit: 5 });
  });

  it('caps limit at 50', async () => {
    invoicesListMock.mockResolvedValueOnce({ data: [], has_more: false });
    await getAdminStripeCustomerInvoices(mockAdminSession(), { customerId: 'cus_x', limit: 999 });
    expect(invoicesListMock).toHaveBeenCalledWith({ customer: 'cus_x', limit: 50 });
  });
});

describe('getAdminStripeCustomerPaymentMethods', () => {
  it('returns mapped card payment methods', async () => {
    paymentMethodsListMock.mockResolvedValueOnce({
      data: [
        {
          id: 'pm_1',
          type: 'card',
          card: {
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2030,
            funding: 'credit',
            country: 'US',
          },
          created: 1700000000,
        },
      ],
    });
    const result = await getAdminStripeCustomerPaymentMethods(mockAdminSession(), {
      customerId: 'cus_x',
    });
    expect(result.paymentMethods.length).toBe(1);
    expect(result.paymentMethods[0].card?.last4).toBe('4242');
  });
});

describe('getAdminStripeCustomerSubscriptions', () => {
  it('returns mapped subscription list', async () => {
    subscriptionsListMock.mockResolvedValueOnce({
      data: [
        {
          id: 'sub_1',
          status: 'active',
          currency: 'usd',
          cancel_at_period_end: false,
          cancel_at: null,
          canceled_at: null,
          ended_at: null,
          trial_start: null,
          trial_end: null,
          created: 1700000000,
          items: {
            data: [
              {
                id: 'si_1',
                price: {
                  id: 'price_1',
                  product: 'prod_1',
                  unit_amount: 5000,
                  recurring: { interval: 'month' },
                },
                current_period_start: 1700000000,
                current_period_end: 1702000000,
                quantity: 1,
              },
            ],
          },
          default_payment_method: 'pm_1',
          latest_invoice: 'in_1',
          metadata: {},
        },
      ],
      has_more: false,
    });
    const result = await getAdminStripeCustomerSubscriptions(mockAdminSession(), {
      customerId: 'cus_x',
    });
    expect(result.subscriptions.length).toBe(1);
    expect(result.subscriptions[0].items[0].priceId).toBe('price_1');
    expect(subscriptionsListMock).toHaveBeenCalledWith({
      customer: 'cus_x',
      status: 'all',
      limit: 20,
    });
  });
});

void env;
