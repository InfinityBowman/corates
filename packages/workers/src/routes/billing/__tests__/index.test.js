/**
 * Tests for billing routes
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedOrgMember,
  json,
} from '../../../__tests__/helpers.js';
import { createDb } from '../../../db/client.js';
import { subscription } from '../../../db/schema.js';

const mockAuthUpgradeSubscription = vi.fn(async () => ({
  url: 'https://checkout.stripe.com/test',
}));
const mockAuthCreateBillingPortal = vi.fn(async () => ({
  url: 'https://billing.stripe.com/test',
}));

// Mock Better Auth config used by billing routes for subscription management.
// This keeps tests focused on our route contract (not Better Auth Stripe plugin internals).
vi.mock('../../../auth/config.js', () => {
  return {
    createAuth: () => {
      return {
        api: {
          upgradeSubscription: mockAuthUpgradeSubscription,
          createBillingPortal: mockAuthCreateBillingPortal,
        },
      };
    },
  };
});

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

    // Set activeOrganizationId in session
    const db = createDb(env.DB);
    const { session: sessionTable } = await import('../../../db/schema.js');
    await db.insert(sessionTable).values({
      id: 'test-session',
      userId,
      token: 'test-token',
      expiresAt: new Date(Date.now() + 86400 * 1000),
      activeOrganizationId: orgId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await fetchBilling('/api/billing/subscription');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.tier).toBe('free');
    expect(body.status).toBe('inactive');
    expect(body.stripeSubscriptionId).toBeNull();
    expect(body.source).toBe('free');
    expect(body.accessMode).toBe('free');
  });

  it('should return org subscription when exists', async () => {
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

    // Create org-scoped subscription
    const db = createDb(env.DB);
    const { session: sessionTable } = await import('../../../db/schema.js');
    await db.insert(sessionTable).values({
      id: 'test-session',
      userId,
      token: 'test-token',
      expiresAt: new Date(Date.now() + 86400 * 1000),
      activeOrganizationId: orgId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(subscription).values({
      id: 'sub-1',
      plan: 'team',
      referenceId: orgId,
      status: 'active',
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
      periodStart: new Date(nowSec * 1000),
      periodEnd: new Date((nowSec + 86400 * 30) * 1000),
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await fetchBilling('/api/billing/subscription');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.tier).toBe('team');
    expect(body.status).toBe('active');
    expect(body.stripeSubscriptionId).toBe('sub-1');
    expect(body.source).toBe('subscription');
    expect(body.accessMode).toBe('full');
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
  it('should create checkout session for valid tier (org-scoped)', async () => {
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

    // Set activeOrganizationId in session
    const db = createDb(env.DB);
    const { session: sessionTable } = await import('../../../db/schema.js');
    await db.insert(sessionTable).values({
      id: 'test-session',
      userId,
      token: 'test-token',
      expiresAt: new Date(Date.now() + 86400 * 1000),
      activeOrganizationId: orgId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await fetchBilling('/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tier: 'team',
        interval: 'monthly',
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.url).toBeDefined();
  });

  it('should reject free tier', async () => {
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

    mockAuthUpgradeSubscription.mockRejectedValueOnce(new Error('Stripe API error'));

    const res = await fetchBilling('/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tier: 'team',
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

describe('Billing Routes - POST /api/billing/single-project/checkout', () => {
  it('should create checkout session for single project purchase', async () => {
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

    // Set activeOrganizationId in session
    const db = createDb(env.DB);
    const { session: sessionTable } = await import('../../../db/schema.js');
    await db.insert(sessionTable).values({
      id: 'test-session',
      userId,
      token: 'test-token',
      expiresAt: new Date(Date.now() + 86400 * 1000),
      activeOrganizationId: orgId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const testEnv = {
      ...env,
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_PRICE_ID_SINGLE_PROJECT: 'price_single_project_test',
      APP_URL: 'http://localhost:5173',
    };

    const ctx = createExecutionContext();
    const req = new Request('http://localhost/api/billing/single-project/checkout', {
      method: 'POST',
      headers: {
        'x-test-user-id': userId,
        'x-test-user-email': 'user1@example.com',
        'content-type': 'application/json',
      },
    });
    const res = await app.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.url).toBeDefined();
    expect(body.sessionId).toBeDefined();
    expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalled();
    const callArgs = mockStripeCheckoutSessionsCreate.mock.calls[0][0];
    expect(callArgs.mode).toBe('payment');
    expect(callArgs.metadata.orgId).toBe(orgId);
    expect(callArgs.metadata.grantType).toBe('single_project');
  });

  it('should reject non-owner users', async () => {
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
      role: 'member', // Not owner
      createdAt: nowSec,
    });

    // Set activeOrganizationId in session
    const db = createDb(env.DB);
    const { session: sessionTable } = await import('../../../db/schema.js');
    await db.insert(sessionTable).values({
      id: 'test-session',
      userId,
      token: 'test-token',
      expiresAt: new Date(Date.now() + 86400 * 1000),
      activeOrganizationId: orgId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const testEnv = {
      ...env,
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_PRICE_ID_SINGLE_PROJECT: 'price_single_project_test',
      APP_URL: 'http://localhost:5173',
    };

    const ctx = createExecutionContext();
    const req = new Request('http://localhost/api/billing/single-project/checkout', {
      method: 'POST',
      headers: {
        'x-test-user-id': userId,
        'x-test-user-email': 'user1@example.com',
        'content-type': 'application/json',
      },
    });
    const res = await app.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/AUTH_FORBIDDEN/);
  });
});

describe('Billing Routes - POST /api/billing/portal', () => {
  it('should create portal session when org subscription exists', async () => {
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

    // Set activeOrganizationId in session
    const db = createDb(env.DB);
    const { session: sessionTable } = await import('../../../db/schema.js');
    await db.insert(sessionTable).values({
      id: 'test-session',
      userId,
      token: 'test-token',
      expiresAt: new Date(Date.now() + 86400 * 1000),
      activeOrganizationId: orgId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create org-scoped subscription
    await db.insert(subscription).values({
      id: 'sub-1',
      plan: 'team',
      referenceId: orgId,
      status: 'active',
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
      periodStart: new Date(nowSec * 1000),
      periodEnd: new Date((nowSec + 86400 * 30) * 1000),
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await fetchBilling('/api/billing/portal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.url).toBeDefined();
  });
});
