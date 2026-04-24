/**
 * Admin billing observability tests.
 *
 * Tests invoke the pure business logic functions in admin-billing.server.ts
 * and admin-orgs.server.ts (reconcile).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetTestDatabase,
  seedOrganization,
  seedSubscription,
  seedStripeEventLedger,
} from '@/__tests__/server/helpers';
import { resetCounter, asOrgId } from '@/__tests__/server/factories';
import { createDb } from '@corates/db/client';
import { env } from 'cloudflare:test';
import type { OrgId } from '@corates/shared/ids';
import type { Session } from '@/server/middleware/auth';
import { reconcileAdminOrgBilling } from '@/server/functions/admin-orgs.server';
import {
  getAdminBillingLedger,
  getAdminBillingStuckStates,
} from '@/server/functions/admin-billing.server';

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
});

function mockAdminSession(): Session {
  return {
    user: { id: 'admin-id', email: 'admin@example.com', name: 'Admin', role: 'admin' },
    session: { id: 'admin-sess', userId: 'admin-id' },
  } as Session;
}

describe('reconcileAdminOrgBilling', () => {
  it('throws 400 for unknown org', async () => {
    try {
      await reconcileAdminOrgBilling(mockAdminSession(), createDb(env.DB), 'nope' as OrgId, {});
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }
  });

  it('detects incomplete subscription older than threshold', async () => {
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

    const result = await reconcileAdminOrgBilling(
      mockAdminSession(),
      createDb(env.DB),
      orgId as OrgId,
      { incompleteThreshold: thresholdMinutes },
    );
    const incomplete = result.stuckStates.find(s => s.type === 'incomplete_subscription');
    expect(incomplete).toBeDefined();
    expect(incomplete?.severity).toBe('high');
    expect(incomplete?.subscriptionId).toBe('sub-incomplete');
  });

  it('detects checkout completed without subscription', async () => {
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

    const result = await reconcileAdminOrgBilling(
      mockAdminSession(),
      createDb(env.DB),
      orgId as OrgId,
      { checkoutNoSubThreshold: thresholdMinutes },
    );
    const checkout = result.stuckStates.find(s => s.type === 'checkout_no_subscription');
    expect(checkout).toBeDefined();
    expect(checkout?.severity).toBe('critical');
    expect(checkout?.ledgerId).toBe('led-checkout');
  });

  it('detects repeated webhook failures', async () => {
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

    const result = await reconcileAdminOrgBilling(
      mockAdminSession(),
      createDb(env.DB),
      orgId as OrgId,
      {},
    );
    const failure = result.stuckStates.find(s => s.type === 'repeated_webhook_failures');
    expect(failure).toBeDefined();
    expect(failure?.severity).toBe('medium');
  });

  it('compares with Stripe when checkStripe=true', async () => {
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

    const result = await reconcileAdminOrgBilling(
      mockAdminSession(),
      createDb(env.DB),
      orgId as OrgId,
      { checkStripe: true },
    );
    expect(result.stripeComparison).toBeDefined();
    const comp = result.stripeComparison!;
    expect(comp.localStatus).toBe('active');
    expect(comp.stripeStatus).toBe('past_due');
    expect(comp.match).toBe(false);
    const mismatch = result.stuckStates.find(s => s.type === 'stripe_status_mismatch');
    expect(mismatch).toBeDefined();
    expect(stripeRetrieveMock).toHaveBeenCalledWith('sub_stripe_999');
  });
});

describe('getAdminBillingLedger', () => {
  it('returns ledger entries with stats', async () => {
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

    const result = await getAdminBillingLedger(mockAdminSession(), createDb(env.DB), { limit: 50 });
    expect(result.stats.total).toBeGreaterThanOrEqual(2);
    expect(result.entries.length).toBeGreaterThanOrEqual(2);
  });

  it('filters by status', async () => {
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

    const result = await getAdminBillingLedger(mockAdminSession(), createDb(env.DB), {
      status: 'failed',
      limit: 50,
    });
    expect(result.entries.length).toBeGreaterThan(0);
    result.entries.forEach(e => expect(e.status).toBe('failed'));
  });

  it('filters by type', async () => {
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

    const result = await getAdminBillingLedger(mockAdminSession(), createDb(env.DB), {
      type: 'checkout.session.completed',
      limit: 50,
    });
    expect(result.entries.length).toBeGreaterThan(0);
    result.entries.forEach(e => expect(e.type).toBe('checkout.session.completed'));
  });
});

describe('getAdminBillingStuckStates', () => {
  it('flags incomplete subscriptions older than threshold', async () => {
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

    const result = await getAdminBillingStuckStates(mockAdminSession(), createDb(env.DB), {
      incompleteThreshold: 30,
    });
    const found = result.stuckOrgs.find(
      (s: { subscriptionId?: string }) => s.subscriptionId === 'sub-stuck',
    );
    expect(found).toBeDefined();
    expect(found?.type).toBe('incomplete_subscription');
  });

  it('flags orgs with repeated webhook failures', async () => {
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

    const result = await getAdminBillingStuckStates(mockAdminSession(), createDb(env.DB), {});
    const found = result.stuckOrgs.find(
      (s: { type: string; orgId?: string }) => s.type === 'repeated_failures' && s.orgId === orgId,
    );
    expect(found).toBeDefined();
    expect(found?.failedCount).toBeGreaterThanOrEqual(3);
  });
});
