/**
 * Tests for billing routes
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { resetTestDatabase, seedUser, seedSubscription, json } from '../../../__tests__/helpers.js';

// Mock postmark to avoid loading runtime code
vi.mock('postmark', () => {
  return {
    Client: class {
      constructor() {}
      sendEmail() {
        return Promise.resolve({ Message: 'mock' });
      }
    },
  };
});

// Mock Stripe
const mockStripeCheckoutSessionsCreate = vi.fn(async () => ({
  id: 'cs_test_123',
  url: 'https://checkout.stripe.com/test',
}));

const mockStripeBillingPortalSessionsCreate = vi.fn(async () => ({
  url: 'https://billing.stripe.com/test',
}));

vi.mock('stripe', () => {
  return {
    default: vi.fn(() => ({
      checkout: {
        sessions: {
          create: mockStripeCheckoutSessionsCreate,
        },
      },
      billingPortal: {
        sessions: {
          create: mockStripeBillingPortalSessionsCreate,
        },
      },
    })),
  };
});

// Mock auth middleware
vi.mock('../../../middleware/auth.js', () => {
  return {
    requireAuth: async (c, next) => {
      const userId = c.req.raw.headers.get('x-test-user-id') || 'user-1';
      const email = c.req.raw.headers.get('x-test-user-email') || 'user1@example.com';
      c.set('user', {
        id: userId,
        email,
        name: 'Test User',
      });
      c.set('session', { id: 'test-session' });
      await next();
    },
    getAuth: c => ({
      user: c.get('user'),
      session: c.get('session'),
    }),
  };
});

let app;

beforeAll(async () => {
  const { billingRoutes } = await import('../index.js');
  app = new Hono();
  app.route('/api/billing', billingRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});

async function fetchBilling(path, init = {}) {
  const testEnv = {
    ...env,
    STRIPE_SECRET_KEY: 'sk_test_123',
    APP_URL: 'http://localhost:5173',
  };

  const ctx = createExecutionContext();
  const req = new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      'x-test-user-id': 'user-1',
      'x-test-user-email': 'user1@example.com',
      ...init.headers,
    },
  });
  const res = await app.fetch(req, testEnv, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe('Billing Routes - GET /api/billing/subscription', () => {
  it('should return free tier when no subscription exists', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchBilling('/api/billing/subscription');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.tier).toBe('free');
    expect(body.status).toBe('active');
    expect(body.stripeSubscriptionId).toBeNull();
  });

  it('should return subscription when exists', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedSubscription({
      id: 'sub-1',
      userId: 'user-1',
      tier: 'pro',
      status: 'active',
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
      currentPeriodStart: nowSec,
      currentPeriodEnd: nowSec + 86400 * 30,
      cancelAtPeriodEnd: 0,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchBilling('/api/billing/subscription');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.tier).toBe('pro');
    expect(body.status).toBe('active');
    expect(body.stripeSubscriptionId).toBe('sub_test');
  });
});

describe('Billing Routes - GET /api/billing/plans', () => {
  it('should return available plans', async () => {
    const res = await fetchBilling('/api/billing/plans');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.plans).toBeDefined();
    expect(Array.isArray(body.plans)).toBe(true);
    expect(body.plans.length).toBeGreaterThan(0);

    const freePlan = body.plans.find(p => p.tier === 'free');
    expect(freePlan).toBeDefined();
    expect(freePlan.price.monthly).toBe(0);
  });
});

describe('Billing Routes - POST /api/billing/checkout', () => {
  it('should create checkout session for valid tier', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchBilling('/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tier: 'pro',
        interval: 'monthly',
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.url).toBeDefined();
    expect(body.sessionId).toBeDefined();
    expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalled();
  });

  it('should reject free tier', async () => {
    const res = await fetchBilling('/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tier: 'free',
        interval: 'monthly',
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/VALIDATION/);
    expect(body.message || body.error).toMatch(/invalid|tier/i);
  });

  it('should reject missing tier', async () => {
    const res = await fetchBilling('/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        interval: 'monthly',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('should handle Stripe errors', async () => {
    mockStripeCheckoutSessionsCreate.mockRejectedValueOnce(new Error('Stripe API error'));

    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchBilling('/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tier: 'pro',
        interval: 'monthly',
      }),
    });

    expect(res.status).toBe(500);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/SYSTEM_INTERNAL_ERROR/);
    expect(body.message || body.error).toBeDefined();
  });
});

describe('Billing Routes - POST /api/billing/portal', () => {
  it('should create portal session when subscription exists', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedSubscription({
      id: 'sub-1',
      userId: 'user-1',
      tier: 'pro',
      status: 'active',
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
      currentPeriodStart: nowSec,
      currentPeriodEnd: nowSec + 86400 * 30,
      cancelAtPeriodEnd: 0,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchBilling('/api/billing/portal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.url).toBeDefined();
    expect(mockStripeBillingPortalSessionsCreate).toHaveBeenCalled();
  });

  it('should reject when no subscription exists', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchBilling('/api/billing/portal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/USER_NOT_FOUND/);
    expect(body.message || body.error).toBeDefined();
  });
});
