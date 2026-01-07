/**
 * Tests for purchase webhook handler (one-time Single Project purchases)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import Stripe from 'stripe';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedOrgMember,
  json,
} from '@/__tests__/helpers.js';
import { createDb } from '@/db/client.js';
import { getGrantByStripeCheckoutSessionId, getGrantByOrgIdAndType } from '@/db/orgAccessGrants.js';

// Use a local hook for the Stripe webhook event construction.
// Stripe itself is globally mocked in test setup; here we just control the returned event.
const mockStripeWebhooksConstructEvent = vi.fn();

let app;

beforeEach(async () => {
  await resetTestDatabase();
  mockStripeWebhooksConstructEvent.mockReset();

  const { billingRoutes } = await import('../index.js');
  app = new Hono();
  app.route('/api/billing', billingRoutes);
});

async function createWebhookRequest(eventType, eventData, signature = 'valid-signature') {
  const testEnv = {
    ...env,
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET_PURCHASES: 'whsec_test',
  };

  const event = {
    id: 'evt_test',
    type: eventType,
    data: {
      object: eventData,
    },
  };

  // Ensure the Stripe constructor returns an object that uses our controllable mock.
  // This must be set per request because other tests may configure Stripe differently.
  Stripe.mockImplementation(() => {
    return {
      webhooks: {
        constructEventAsync: mockStripeWebhooksConstructEvent,
      },
    };
  });

  mockStripeWebhooksConstructEvent.mockResolvedValueOnce(event);

  const ctx = createExecutionContext();
  const req = new Request('http://localhost/api/billing/purchases/webhook', {
    method: 'POST',
    headers: {
      'stripe-signature': signature,
      'content-type': 'application/json',
    },
    body: JSON.stringify(eventData),
  });

  const res = await app.fetch(req, testEnv, ctx);
  await waitOnExecutionContext(ctx);

  return { res, testEnv };
}

describe('Purchase Webhook Handler', () => {
  it('should verify webhook signature', async () => {
    mockStripeWebhooksConstructEvent.mockClear();
    mockStripeWebhooksConstructEvent.mockRejectedValueOnce(new Error('Invalid signature'));

    const { res } = await createWebhookRequest(
      'checkout.session.completed',
      {},
      'invalid-signature',
    );

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/AUTH_FORBIDDEN/);
  });

  it('should create new single_project grant on successful purchase', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    const orgId = 'org-1';
    const userId = 'user-1';

    await seedUser({
      id: userId,
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'member-1',
      userId,
      organizationId: orgId,
      role: 'owner',
      createdAt: nowSec,
    });

    const sessionData = {
      id: 'cs_test_123',
      mode: 'payment',
      payment_status: 'paid',
      payment_intent: 'pi_test_123',
      metadata: {
        orgId,
        grantType: 'single_project',
        purchaserUserId: userId,
      },
    };

    const { res } = await createWebhookRequest('checkout.session.completed', sessionData);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.received).toBe(true);
    expect(body.action).toBe('created');
    expect(body.grantId).toBeDefined();

    // Verify grant was created
    const db = createDb(env.DB);
    const grant = await getGrantByStripeCheckoutSessionId(db, 'cs_test_123');
    expect(grant).toBeDefined();
    expect(grant.type).toBe('single_project');
    expect(grant.orgId).toBe(orgId);
    expect(grant.stripeCheckoutSessionId).toBe('cs_test_123');
    expect(grant.revokedAt).toBeNull();
  });

  it('should extend existing single_project grant on repeat purchase', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    const orgId = 'org-1';
    const userId = 'user-1';

    await seedUser({
      id: userId,
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'member-1',
      userId,
      organizationId: orgId,
      role: 'owner',
      createdAt: nowSec,
    });

    // Create existing grant (expires in 6 months)
    const db = createDb(env.DB);
    const { createGrant } = await import('@/db/orgAccessGrants.js');
    const existingGrantId = 'grant-1';
    const existingExpiresAt = new Date();
    existingExpiresAt.setMonth(existingExpiresAt.getMonth() + 6);

    await createGrant(db, {
      id: existingGrantId,
      orgId,
      type: 'single_project',
      startsAt: new Date(),
      expiresAt: existingExpiresAt,
    });

    const sessionData = {
      id: 'cs_test_456',
      mode: 'payment',
      payment_status: 'paid',
      payment_intent: 'pi_test_456',
      metadata: {
        orgId,
        grantType: 'single_project',
        purchaserUserId: userId,
      },
    };

    const { res } = await createWebhookRequest('checkout.session.completed', sessionData);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.received).toBe(true);
    expect(body.action).toBe('extended');
    expect(body.grantId).toBe(existingGrantId);

    // Verify grant was extended by 6 months from max(now, existingExpiresAt)
    const extendedGrant = await getGrantByOrgIdAndType(db, orgId, 'single_project');
    expect(extendedGrant).toBeDefined();
    const newExpiresAt =
      extendedGrant.expiresAt instanceof Date ?
        Math.floor(extendedGrant.expiresAt.getTime() / 1000)
      : extendedGrant.expiresAt;
    const originalExpiresAt =
      existingExpiresAt instanceof Date ?
        Math.floor(existingExpiresAt.getTime() / 1000)
      : existingExpiresAt;
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const baseExpiresAt = Math.max(nowTimestamp, originalExpiresAt);
    // Expected expiry uses calendar months (Date#setMonth), not fixed 30-day months
    const expectedDate = new Date(baseExpiresAt * 1000);
    expectedDate.setMonth(expectedDate.getMonth() + 6);
    const expectedExpiresAt = Math.floor(expectedDate.getTime() / 1000);
    // Allow some tolerance for test execution time
    expect(newExpiresAt).toBeGreaterThan(originalExpiresAt);
    expect(Math.abs(newExpiresAt - expectedExpiresAt)).toBeLessThan(60); // Within 60 seconds
  });

  it('should be idempotent (skip if grant already exists for session)', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    const orgId = 'org-1';
    const userId = 'user-1';

    await seedUser({
      id: userId,
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'member-1',
      userId,
      organizationId: orgId,
      role: 'owner',
      createdAt: nowSec,
    });

    // Create grant with same checkout session ID
    const db = createDb(env.DB);
    const { createGrant } = await import('@/db/orgAccessGrants.js');
    await createGrant(db, {
      id: 'grant-1',
      orgId,
      type: 'single_project',
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000), // 6 months
      stripeCheckoutSessionId: 'cs_test_123',
    });

    const sessionData = {
      id: 'cs_test_123',
      mode: 'payment',
      payment_status: 'paid',
      payment_intent: 'pi_test_123',
      metadata: {
        orgId,
        grantType: 'single_project',
        purchaserUserId: userId,
      },
    };

    const { res } = await createWebhookRequest('checkout.session.completed', sessionData);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.received).toBe(true);
    expect(body.skipped).toBe('already_processed');
  });

  it('should skip non-payment mode checkout sessions', async () => {
    const sessionData = {
      id: 'cs_test_123',
      mode: 'subscription',
      payment_status: 'paid',
      metadata: {
        orgId: 'org-1',
        grantType: 'single_project',
      },
    };

    const { res } = await createWebhookRequest('checkout.session.completed', sessionData);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.received).toBe(true);
    expect(body.skipped).toBe('not_payment_mode');
  });

  it('should reject invalid metadata', async () => {
    // Ensure mock is set up for this test
    mockStripeWebhooksConstructEvent.mockClear();

    const sessionData = {
      id: 'cs_test_123',
      mode: 'payment',
      payment_status: 'paid',
      metadata: {
        // Missing orgId and grantType
      },
    };

    const { res } = await createWebhookRequest('checkout.session.completed', sessionData);

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/VALIDATION_INVALID_INPUT/);
  });

  it('should reject invalid metadata - missing metadata entirely', async () => {
    const sessionData = {
      id: 'cs_test_123',
      mode: 'payment',
      payment_status: 'paid',
      // No metadata field at all
    };

    const { res } = await createWebhookRequest('checkout.session.completed', sessionData);

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/VALIDATION_INVALID_INPUT/);
  });

  it('should reject unpaid sessions', async () => {
    const sessionData = {
      id: 'cs_test_123',
      mode: 'payment',
      payment_status: 'unpaid',
      metadata: {
        orgId: 'org-1',
        grantType: 'single_project',
        purchaserUserId: 'user-1',
      },
    };

    const { res } = await createWebhookRequest('checkout.session.completed', sessionData);

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/VALIDATION_INVALID_INPUT/);
  });
});
