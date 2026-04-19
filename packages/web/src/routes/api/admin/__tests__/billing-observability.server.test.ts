import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetTestDatabase,
  seedOrganization,
  seedSubscription,
  seedStripeEventLedger,
} from '@/__tests__/server/helpers';
import { buildAdminUser, buildUser, resetCounter, asOrgId } from '@/__tests__/server/factories';
import { handleGet as reconcile } from '../orgs/$orgId/billing/reconcile';
import { handleGet as stuckStates } from '../billing/stuck-states';
import { handleGet as ledger } from '../billing/ledger';

let sessionResult: {
  user: { id: string; email: string; name: string; role?: string };
  session: { id: string; userId: string; activeOrganizationId: string | null };
} | null = null;

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => sessionResult,
}));

const stripeRetrieveMock = vi.fn();
vi.mock('@corates/workers/stripe', () => ({
  createStripeClient: () => ({
    subscriptions: { retrieve: (...args: unknown[]) => stripeRetrieveMock(...args) },
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

function reconcileReq(orgId: string, qs = ''): Request {
  return new Request(`http://localhost/api/admin/orgs/${orgId}/billing/reconcile${qs}`);
}

function ledgerReq(qs = ''): Request {
  return new Request(`http://localhost/api/admin/billing/ledger${qs}`);
}

function stuckReq(qs = ''): Request {
  return new Request(`http://localhost/api/admin/billing/stuck-states${qs}`);
}

describe('GET /api/admin/orgs/:orgId/billing/reconcile', () => {
  it('returns 401 when no session', async () => {
    const res = await reconcile({ request: reconcileReq('x'), params: { orgId: asOrgId('x') } });
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not admin', async () => {
    const u = await buildUser();
    sessionResult = {
      user: { id: u.id, email: u.email, name: u.name, role: 'user' },
      session: { id: 'sess', userId: u.id, activeOrganizationId: null },
    };
    const res = await reconcile({ request: reconcileReq('x'), params: { orgId: asOrgId('x') } });
    expect(res.status).toBe(403);
  });

  it('returns 400 for unknown org', async () => {
    await asAdmin();
    const res = await reconcile({
      request: reconcileReq('nope'),
      params: { orgId: asOrgId('nope') },
    });
    expect(res.status).toBe(400);
  });

  it('detects incomplete subscription older than threshold', async () => {
    await asAdmin();
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = asOrgId('org-recon-1');
    await seedOrganization({ id: orgId, name: 'Recon', slug: 'recon', createdAt: nowSec });

    const thresholdMinutes = 30;
    await seedSubscription({
      id: 'sub-incomplete',
      plan: 'team',
      referenceId: orgId,
      status: 'incomplete',
      createdAt: nowSec - (thresholdMinutes + 10) * 60,
      updatedAt: nowSec - (thresholdMinutes + 10) * 60,
    });

    const res = await reconcile({
      request: reconcileReq(orgId, `?incompleteThreshold=${thresholdMinutes}`),
      params: { orgId },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { stuckStates: Record<string, unknown>[] };
    const incomplete = body.stuckStates.find(s => s.type === 'incomplete_subscription');
    expect(incomplete).toBeDefined();
    expect(incomplete?.severity).toBe('high');
    expect(incomplete?.subscriptionId).toBe('sub-incomplete');
  });

  it('detects checkout completed without subscription', async () => {
    await asAdmin();
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = asOrgId('org-recon-2');
    await seedOrganization({ id: orgId, name: 'Recon2', slug: 'recon2', createdAt: nowSec });

    const thresholdMinutes = 15;
    await seedStripeEventLedger({
      id: 'led-checkout',
      payloadHash: 'h-co',
      receivedAt: nowSec - (thresholdMinutes + 5) * 60 - 60,
      route: '/webhooks/stripe',
      requestId: 'req-co',
      status: 'processed',
      type: 'checkout.session.completed',
      orgId,
      stripeCustomerId: 'cus_test',
      stripeCheckoutSessionId: 'cs_test',
      processedAt: nowSec - (thresholdMinutes + 5) * 60,
    });

    const res = await reconcile({
      request: reconcileReq(orgId, `?checkoutNoSubThreshold=${thresholdMinutes}`),
      params: { orgId },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { stuckStates: Record<string, unknown>[] };
    const checkout = body.stuckStates.find(s => s.type === 'checkout_no_subscription');
    expect(checkout).toBeDefined();
    expect(checkout?.severity).toBe('critical');
    expect(checkout?.ledgerId).toBe('led-checkout');
  });

  it('detects repeated webhook failures', async () => {
    await asAdmin();
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = asOrgId('org-recon-3');
    await seedOrganization({ id: orgId, name: 'Recon3', slug: 'recon3', createdAt: nowSec });

    for (let i = 0; i < 4; i++) {
      await seedStripeEventLedger({
        id: `led-fail-${i}`,
        payloadHash: `hash-fail-${i}`,
        receivedAt: nowSec - (4 - i) * 60,
        route: '/webhooks/stripe',
        requestId: `req-fail-${i}`,
        status: 'failed',
        error: 'Processing error',
        httpStatus: 500,
        orgId,
      });
    }

    const res = await reconcile({ request: reconcileReq(orgId), params: { orgId } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { stuckStates: Record<string, unknown>[] };
    const failure = body.stuckStates.find(s => s.type === 'repeated_webhook_failures');
    expect(failure).toBeDefined();
    expect(failure?.severity).toBe('medium');
  });

  it('compares with Stripe when checkStripe=true', async () => {
    await asAdmin();
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = asOrgId('org-recon-4');
    await seedOrganization({ id: orgId, name: 'Recon4', slug: 'recon4', createdAt: nowSec });
    await seedSubscription({
      id: 'sub-active',
      plan: 'team',
      referenceId: orgId,
      status: 'active',
      stripeSubscriptionId: 'sub_stripe_999',
      createdAt: nowSec,
      updatedAt: nowSec,
    });
    stripeRetrieveMock.mockResolvedValueOnce({ id: 'sub_stripe_999', status: 'past_due' });

    const res = await reconcile({
      request: new Request(
        `http://localhost/api/admin/orgs/${orgId}/billing/reconcile?checkStripe=true`,
      ),
      params: { orgId },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      stripeComparison: { localStatus: string; stripeStatus: string; match: boolean };
      stuckStates: Record<string, unknown>[];
    };
    expect(body.stripeComparison.localStatus).toBe('active');
    expect(body.stripeComparison.stripeStatus).toBe('past_due');
    expect(body.stripeComparison.match).toBe(false);
    const mismatch = body.stuckStates.find(s => s.type === 'stripe_status_mismatch');
    expect(mismatch).toBeDefined();
    expect(stripeRetrieveMock).toHaveBeenCalledWith('sub_stripe_999');
  });
});

describe('GET /api/admin/billing/ledger', () => {
  it('returns 401 when no session', async () => {
    const res = await ledger({ request: ledgerReq() });
    expect(res.status).toBe(401);
  });

  it('returns ledger entries with stats', async () => {
    await asAdmin();
    const nowSec = Math.floor(Date.now() / 1000);
    await seedStripeEventLedger({
      id: 'l1',
      payloadHash: 'h1',
      receivedAt: nowSec,
      route: '/webhooks/stripe',
      requestId: 'r1',
      status: 'processed',
      type: 'checkout.session.completed',
    });
    await seedStripeEventLedger({
      id: 'l2',
      payloadHash: 'h2',
      receivedAt: nowSec + 60,
      route: '/webhooks/stripe',
      requestId: 'r2',
      status: 'failed',
      type: 'customer.subscription.updated',
    });

    const res = await ledger({ request: ledgerReq('?limit=50') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      stats: { total: number; byStatus: Record<string, number>; byType: Record<string, number> };
      entries: { status: string }[];
    };
    expect(body.stats.total).toBeGreaterThanOrEqual(2);
    expect(body.entries.length).toBeGreaterThanOrEqual(2);
  });

  it('filters by status', async () => {
    await asAdmin();
    const nowSec = Math.floor(Date.now() / 1000);
    await seedStripeEventLedger({
      id: 'lp',
      payloadHash: 'hp',
      receivedAt: nowSec,
      route: '/webhooks/stripe',
      requestId: 'rp',
      status: 'processed',
    });
    await seedStripeEventLedger({
      id: 'lf',
      payloadHash: 'hf',
      receivedAt: nowSec + 60,
      route: '/webhooks/stripe',
      requestId: 'rf',
      status: 'failed',
    });

    const res = await ledger({ request: ledgerReq('?status=failed&limit=50') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: { status: string }[] };
    expect(body.entries.length).toBeGreaterThan(0);
    body.entries.forEach(e => expect(e.status).toBe('failed'));
  });

  it('filters by type', async () => {
    await asAdmin();
    const nowSec = Math.floor(Date.now() / 1000);
    await seedStripeEventLedger({
      id: 'lc',
      payloadHash: 'hc',
      receivedAt: nowSec,
      route: '/webhooks/stripe',
      requestId: 'rc',
      status: 'processed',
      type: 'checkout.session.completed',
    });

    const res = await ledger({
      request: ledgerReq('?type=checkout.session.completed&limit=50'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: { type: string | null }[] };
    expect(body.entries.length).toBeGreaterThan(0);
    body.entries.forEach(e => expect(e.type).toBe('checkout.session.completed'));
  });
});

describe('GET /api/admin/billing/stuck-states', () => {
  it('returns 401 when no session', async () => {
    const res = await stuckStates({ request: stuckReq() });
    expect(res.status).toBe(401);
  });

  it('flags incomplete subscriptions older than threshold', async () => {
    await asAdmin();
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = asOrgId('org-stuck-1');
    await seedOrganization({ id: orgId, name: 'Stuck', slug: 'stuck', createdAt: nowSec });
    await seedSubscription({
      id: 'sub-stuck',
      plan: 'team',
      referenceId: orgId,
      status: 'incomplete',
      createdAt: nowSec - 60 * 60,
      updatedAt: nowSec - 60 * 60,
    });

    const res = await stuckStates({ request: stuckReq('?incompleteThreshold=30') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { stuckOrgs: Record<string, unknown>[] };
    const found = body.stuckOrgs.find(s => s.subscriptionId === 'sub-stuck');
    expect(found).toBeDefined();
    expect(found?.type).toBe('incomplete_subscription');
  });

  it('flags orgs with repeated webhook failures', async () => {
    await asAdmin();
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = asOrgId('org-stuck-2');
    await seedOrganization({ id: orgId, name: 'Stuck2', slug: 'stuck2', createdAt: nowSec });
    for (let i = 0; i < 4; i++) {
      await seedStripeEventLedger({
        id: `gf-${i}`,
        payloadHash: `gh-${i}`,
        receivedAt: nowSec - i * 60,
        route: '/webhooks/stripe',
        requestId: `gr-${i}`,
        status: 'failed',
        error: 'oops',
        orgId,
      });
    }

    const res = await stuckStates({ request: stuckReq() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { stuckOrgs: Record<string, unknown>[] };
    const found = body.stuckOrgs.find(s => s.type === 'repeated_failures' && s.orgId === orgId);
    expect(found).toBeDefined();
    expect(found?.failedCount).toBeGreaterThanOrEqual(3);
  });
});
