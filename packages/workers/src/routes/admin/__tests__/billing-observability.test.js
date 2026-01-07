/**
 * Tests for admin billing observability routes
 * Tests reconciliation endpoints for detecting stuck billing states
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  seedOrganization,
  seedSubscription,
  seedStripeEventLedger,
  json,
} from '@/__tests__/helpers.js';
import Stripe from 'stripe';

vi.mock('@/middleware/requireAdmin.js', () => {
  return {
    isAdmin: () => true,
    requireAdmin: async (c, next) => {
      c.set('user', {
        id: 'admin-user',
        role: 'admin',
        email: 'admin@example.com',
        name: 'Admin User',
      });
      c.set('session', { id: 'admin-session' });
      c.set('isAdmin', true);
      await next();
    },
  };
});

let app;

async function fetchApp(path, init = {}) {
  const ctx = createExecutionContext();
  const req = new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      origin: 'http://localhost:5173',
      ...init.headers,
    },
  });
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

beforeAll(async () => {
  const { billingObservabilityRoutes } = await import('../billing-observability.js');
  app = new Hono();
  app.route('/api/admin', billingObservabilityRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});

describe('Admin billing observability - GET /api/admin/orgs/:orgId/billing/reconcile', () => {
  it('should detect incomplete subscription older than threshold', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    const thresholdMinutes = 30;
    const createdAtSeconds = nowSec - (thresholdMinutes + 10) * 60;

    await seedSubscription({
      id: 'sub-1',
      plan: 'team',
      referenceId: orgId,
      status: 'incomplete',
      createdAt: createdAtSeconds,
      updatedAt: createdAtSeconds,
    });

    const res = await fetchApp(
      `/api/admin/orgs/${orgId}/billing/reconcile?incompleteThreshold=${thresholdMinutes}`,
    );
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.stuckStates).toBeDefined();
    expect(body.stuckStates.length).toBeGreaterThan(0);

    const incompleteState = body.stuckStates.find(s => s.type === 'incomplete_subscription');
    expect(incompleteState).toBeDefined();
    expect(incompleteState.subscriptionId).toBe('sub-1');
    expect(incompleteState.status).toBe('incomplete');
    expect(incompleteState.severity).toBe('high');
    expect(incompleteState.ageMinutes).toBeGreaterThan(thresholdMinutes);
  });

  it('should detect checkout completed but no subscription created', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    const thresholdMinutes = 15;
    const processedAtSeconds = nowSec - (thresholdMinutes + 5) * 60;

    await seedStripeEventLedger({
      id: 'ledger-1',
      payloadHash: 'hash-1',
      signaturePresent: true,
      receivedAt: processedAtSeconds - 60,
      route: '/api/billing/purchases/webhook',
      requestId: 'req-1',
      status: 'processed',
      type: 'checkout.session.completed',
      orgId,
      stripeCustomerId: 'cus_test',
      stripeCheckoutSessionId: 'cs_test',
      processedAt: processedAtSeconds,
    });

    const res = await fetchApp(
      `/api/admin/orgs/${orgId}/billing/reconcile?checkoutNoSubThreshold=${thresholdMinutes}`,
    );
    expect(res.status).toBe(200);

    const body = await json(res);
    const checkoutState = body.stuckStates.find(s => s.type === 'checkout_no_subscription');
    expect(checkoutState).toBeDefined();
    expect(checkoutState.severity).toBe('critical');
    expect(checkoutState.ledgerId).toBe('ledger-1');
    expect(checkoutState.stripeCheckoutSessionId).toBe('cs_test');
    expect(checkoutState.ageMinutes).toBeGreaterThan(thresholdMinutes);
  });

  it('should detect repeated webhook failures', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    for (let i = 0; i < 4; i++) {
      await seedStripeEventLedger({
        id: `ledger-fail-${i}`,
        payloadHash: `hash-fail-${i}`,
        signaturePresent: true,
        receivedAt: nowSec - (4 - i) * 60,
        route: '/api/billing/purchases/webhook',
        requestId: `req-fail-${i}`,
        status: 'failed',
        error: 'Processing error',
        httpStatus: 500,
        orgId,
      });
    }

    const res = await fetchApp(`/api/admin/orgs/${orgId}/billing/reconcile`);
    expect(res.status).toBe(200);

    const body = await json(res);
    const failureState = body.stuckStates.find(s => s.type === 'repeated_webhook_failures');
    expect(failureState).toBeDefined();
    expect(failureState.severity).toBe('medium');
    expect(failureState.failedCount).toBeGreaterThanOrEqual(3);
    expect(failureState.recentFailures).toBeDefined();
    expect(failureState.recentFailures.length).toBeGreaterThan(0);
  });

  it('should detect processing lag for unprocessed events', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    const thresholdMinutes = 5;
    const receivedAtSeconds = nowSec - (thresholdMinutes + 3) * 60;

    await seedStripeEventLedger({
      id: 'ledger-lag-1',
      payloadHash: 'hash-lag-1',
      signaturePresent: true,
      receivedAt: receivedAtSeconds,
      route: '/api/billing/purchases/webhook',
      requestId: 'req-lag-1',
      status: 'received',
      processedAt: null,
      orgId,
    });

    const res = await fetchApp(
      `/api/admin/orgs/${orgId}/billing/reconcile?processingLagThreshold=${thresholdMinutes}`,
    );
    expect(res.status).toBe(200);

    const body = await json(res);
    const lagState = body.stuckStates.find(s => s.type === 'processing_lag');
    expect(lagState).toBeDefined();
    expect(lagState.severity).toBe('medium');
    expect(lagState.ledgerId).toBe('ledger-lag-1');
    expect(lagState.lagMinutes).toBeGreaterThan(thresholdMinutes);
  });

  it('should call Stripe API when checkStripe=true', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    const mockStripeRetrieve = vi.fn(async () => ({
      id: 'sub_stripe_123',
      status: 'active',
    }));

    Stripe.mockImplementation(() => ({
      subscriptions: {
        retrieve: mockStripeRetrieve,
      },
    }));

    await seedSubscription({
      id: 'sub-1',
      plan: 'team',
      referenceId: orgId,
      status: 'active',
      stripeSubscriptionId: 'sub_stripe_123',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const testEnv = {
      ...env,
      STRIPE_SECRET_KEY: 'sk_test_123',
    };

    const ctx = createExecutionContext();
    const req = new Request(
      `http://localhost/api/admin/orgs/${orgId}/billing/reconcile?checkStripe=true`,
      {
        headers: {
          origin: 'http://localhost:5173',
        },
      },
    );
    const res = await app.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.stripeComparison).toBeDefined();
    expect(body.stripeComparison.checked).toBe(true);
    expect(body.stripeComparison.stripeSubscriptionId).toBe('sub_stripe_123');
    expect(mockStripeRetrieve).toHaveBeenCalledWith('sub_stripe_123');
  });

  it('should return summary statistics', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedSubscription({
      id: 'sub-1',
      plan: 'team',
      referenceId: orgId,
      status: 'active',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedStripeEventLedger({
      id: 'ledger-1',
      payloadHash: 'hash-1',
      signaturePresent: true,
      receivedAt: nowSec,
      route: '/api/billing/purchases/webhook',
      requestId: 'req-1',
      status: 'processed',
      orgId,
    });

    const res = await fetchApp(`/api/admin/orgs/${orgId}/billing/reconcile`);
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.summary).toBeDefined();
    expect(body.summary.totalSubscriptions).toBe(1);
    expect(body.summary.totalLedgerEntries).toBeGreaterThanOrEqual(1);
    expect(body.thresholds).toBeDefined();
    expect(body.orgId).toBe(orgId);
    expect(body.orgName).toBe('Test Org');
  });
});

describe('Admin billing observability - GET /api/admin/billing/ledger', () => {
  it('should return ledger entries with stats', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedStripeEventLedger({
      id: 'ledger-1',
      payloadHash: 'hash-1',
      signaturePresent: true,
      receivedAt: nowSec,
      route: '/api/billing/purchases/webhook',
      requestId: 'req-1',
      status: 'processed',
      type: 'checkout.session.completed',
    });

    await seedStripeEventLedger({
      id: 'ledger-2',
      payloadHash: 'hash-2',
      signaturePresent: true,
      receivedAt: nowSec + 60,
      route: '/api/billing/purchases/webhook',
      requestId: 'req-2',
      status: 'failed',
      type: 'customer.subscription.updated',
    });

    const res = await fetchApp('/api/admin/billing/ledger?limit=50');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.stats).toBeDefined();
    expect(body.stats.total).toBeGreaterThanOrEqual(2);
    expect(body.stats.byStatus).toBeDefined();
    expect(body.stats.byType).toBeDefined();
    expect(body.entries).toBeDefined();
    expect(body.entries.length).toBeGreaterThanOrEqual(2);
  });

  it('should filter by status', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedStripeEventLedger({
      id: 'ledger-processed',
      payloadHash: 'hash-processed',
      signaturePresent: true,
      receivedAt: nowSec,
      route: '/api/billing/purchases/webhook',
      requestId: 'req-processed',
      status: 'processed',
    });

    await seedStripeEventLedger({
      id: 'ledger-failed',
      payloadHash: 'hash-failed',
      signaturePresent: true,
      receivedAt: nowSec + 60,
      route: '/api/billing/purchases/webhook',
      requestId: 'req-failed',
      status: 'failed',
    });

    const res = await fetchApp('/api/admin/billing/ledger?status=failed&limit=50');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.entries).toBeDefined();
    const failedEntries = body.entries.filter(e => e.status === 'failed');
    expect(failedEntries.length).toBeGreaterThan(0);
    failedEntries.forEach(entry => {
      expect(entry.status).toBe('failed');
    });
  });

  it('should filter by event type', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedStripeEventLedger({
      id: 'ledger-checkout',
      payloadHash: 'hash-checkout',
      signaturePresent: true,
      receivedAt: nowSec,
      route: '/api/billing/purchases/webhook',
      requestId: 'req-checkout',
      status: 'processed',
      type: 'checkout.session.completed',
    });

    const res = await fetchApp(
      '/api/admin/billing/ledger?type=checkout.session.completed&limit=50',
    );
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.entries).toBeDefined();
    const checkoutEntries = body.entries.filter(e => e.type === 'checkout.session.completed');
    expect(checkoutEntries.length).toBeGreaterThan(0);
  });
});
