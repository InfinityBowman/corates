import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase, seedSubscription } from '@/__tests__/server/helpers';
import { buildAdminUser, buildOrg, buildUser, resetCounter } from '@/__tests__/server/factories';
import { handleGet as customerLookup } from '../stripe/customer';
import { handlePost as portalLink } from '../stripe/portal-link';
import { handleGet as customerInvoices } from '../stripe/customer/$customerId/invoices';
import { handleGet as customerPaymentMethods } from '../stripe/customer/$customerId/payment-methods';
import { handleGet as customerSubscriptions } from '../stripe/customer/$customerId/subscriptions';

let sessionResult: {
  user: { id: string; email: string; name: string; role?: string };
  session: { id: string; userId: string; activeOrganizationId: string | null };
} | null = null;

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => sessionResult,
}));

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

describe('GET /api/admin/stripe/customer', () => {
  it('returns 401 when no session', async () => {
    const res = await customerLookup({
      request: new Request('http://localhost/api/admin/stripe/customer?email=a@b.com'),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not admin', async () => {
    const u = await buildUser();
    sessionResult = {
      user: { id: u.id, email: u.email, name: u.name, role: 'user' },
      session: { id: 's', userId: u.id, activeOrganizationId: null },
    };
    const res = await customerLookup({
      request: new Request('http://localhost/api/admin/stripe/customer?email=a@b.com'),
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 when neither email nor customerId provided', async () => {
    await asAdmin();
    const res = await customerLookup({
      request: new Request('http://localhost/api/admin/stripe/customer'),
    });
    expect(res.status).toBe(400);
  });

  it('returns found:false for deleted customer', async () => {
    await asAdmin();
    customersRetrieveMock.mockResolvedValueOnce({ id: 'cus_x', deleted: true });
    const res = await customerLookup({
      request: new Request('http://localhost/api/admin/stripe/customer?customerId=cus_x'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { found: boolean; message: string };
    expect(body.found).toBe(false);
    expect(body.message).toMatch(/deleted/i);
  });

  it('returns found:false for missing customer id', async () => {
    await asAdmin();
    customersRetrieveMock.mockRejectedValueOnce(
      Object.assign(new Error('not found'), { code: 'resource_missing' }),
    );
    const res = await customerLookup({
      request: new Request('http://localhost/api/admin/stripe/customer?customerId=cus_missing'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { found: boolean };
    expect(body.found).toBe(false);
  });

  it('returns found:false when email has no Stripe match', async () => {
    await asAdmin();
    customersListMock.mockResolvedValueOnce({ data: [] });
    const res = await customerLookup({
      request: new Request('http://localhost/api/admin/stripe/customer?email=nobody@example.com'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { found: boolean };
    expect(body.found).toBe(false);
  });

  it('returns customer with linked org from subscription table', async () => {
    await asAdmin();
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

    const res = await customerLookup({
      request: new Request('http://localhost/api/admin/stripe/customer?customerId=cus_linked'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      found: boolean;
      customer: { id: string };
      linkedOrg: { id: string } | null;
      stripeDashboardUrl: string;
    };
    expect(body.found).toBe(true);
    expect(body.customer.id).toBe('cus_linked');
    expect(body.linkedOrg?.id).toBe(org.id);
    expect(body.stripeDashboardUrl).toContain('cus_linked');
  });
});

describe('POST /api/admin/stripe/portal-link', () => {
  it('returns 400 when customerId missing', async () => {
    await asAdmin();
    const res = await portalLink({
      request: new Request('http://localhost/api/admin/stripe/portal-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3010' },
        body: JSON.stringify({}),
      }),
    });
    expect(res.status).toBe(400);
  });

  it('creates a portal session and returns URL', async () => {
    await asAdmin();
    portalSessionsCreateMock.mockResolvedValueOnce({
      url: 'https://billing.stripe.com/sess_admin',
      created: 1700000000,
    });
    const res = await portalLink({
      request: new Request('http://localhost/api/admin/stripe/portal-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3010' },
        body: JSON.stringify({ customerId: 'cus_admin' }),
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; success: boolean; expiresAt: number };
    expect(body.success).toBe(true);
    expect(body.url).toBe('https://billing.stripe.com/sess_admin');
    expect(body.expiresAt).toBe(1700000000 + 300);
    expect(portalSessionsCreateMock).toHaveBeenCalledWith({
      customer: 'cus_admin',
      return_url: expect.any(String),
    });
  });
});

describe('GET /api/admin/stripe/customer/:customerId/invoices', () => {
  it('returns 401 when no session', async () => {
    const res = await customerInvoices({
      request: new Request('http://localhost/api/admin/stripe/customer/cus_x/invoices'),
      params: { customerId: 'cus_x' },
    });
    expect(res.status).toBe(401);
  });

  it('returns invoice list mapped to API shape', async () => {
    await asAdmin();
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
    const res = await customerInvoices({
      request: new Request('http://localhost/api/admin/stripe/customer/cus_x/invoices?limit=5'),
      params: { customerId: 'cus_x' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      customerId: string;
      invoices: { id: string; subscriptionId: string | null }[];
      hasMore: boolean;
    };
    expect(body.customerId).toBe('cus_x');
    expect(body.invoices.length).toBe(1);
    expect(body.invoices[0].id).toBe('in_1');
    expect(body.invoices[0].subscriptionId).toBe('sub_1');
    expect(body.hasMore).toBe(false);
    expect(invoicesListMock).toHaveBeenCalledWith({ customer: 'cus_x', limit: 5 });
  });

  it('caps limit at 50', async () => {
    await asAdmin();
    invoicesListMock.mockResolvedValueOnce({ data: [], has_more: false });
    await customerInvoices({
      request: new Request('http://localhost/api/admin/stripe/customer/cus_x/invoices?limit=999'),
      params: { customerId: 'cus_x' },
    });
    expect(invoicesListMock).toHaveBeenCalledWith({ customer: 'cus_x', limit: 50 });
  });
});

describe('GET /api/admin/stripe/customer/:customerId/payment-methods', () => {
  it('returns mapped card payment methods', async () => {
    await asAdmin();
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
    const res = await customerPaymentMethods({
      request: new Request('http://localhost/api/admin/stripe/customer/cus_x/payment-methods'),
      params: { customerId: 'cus_x' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      paymentMethods: { id: string; card: { last4: string } | null }[];
    };
    expect(body.paymentMethods.length).toBe(1);
    expect(body.paymentMethods[0].card?.last4).toBe('4242');
  });
});

describe('GET /api/admin/stripe/customer/:customerId/subscriptions', () => {
  it('returns mapped subscription list', async () => {
    await asAdmin();
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
    const res = await customerSubscriptions({
      request: new Request('http://localhost/api/admin/stripe/customer/cus_x/subscriptions'),
      params: { customerId: 'cus_x' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      subscriptions: { id: string; items: { priceId: string }[] }[];
    };
    expect(body.subscriptions.length).toBe(1);
    expect(body.subscriptions[0].items[0].priceId).toBe('price_1');
    expect(subscriptionsListMock).toHaveBeenCalledWith({
      customer: 'cus_x',
      status: 'all',
      limit: 20,
    });
  });
});

void env;
