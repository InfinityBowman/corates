/**
 * Tests for Stripe webhook handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase, seedUser, seedSubscription } from '../../../__tests__/helpers.js';
import { handleWebhook } from '../webhooks.js';
import { createDb } from '../../../db/client.js';
import { getSubscriptionByStripeSubscriptionId } from '../../../db/subscriptions.js';

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
const mockStripeWebhooksConstructEvent = vi.fn();
const mockStripeSubscriptionsRetrieve = vi.fn();
let mockStripeInstance;

vi.mock('stripe', () => {
  return {
    default: vi.fn(() => {
      mockStripeInstance = {
        webhooks: {
          constructEventAsync: mockStripeWebhooksConstructEvent,
        },
        subscriptions: {
          retrieve: mockStripeSubscriptionsRetrieve,
        },
      };
      return mockStripeInstance;
    }),
  };
});

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});

async function createWebhookRequest(eventType, eventData) {
  const testEnv = {
    ...env,
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
  };

  const event = {
    id: 'evt_test',
    type: eventType,
    data: {
      object: eventData,
    },
  };

  mockStripeWebhooksConstructEvent.mockResolvedValueOnce(event);

  return { testEnv, event };
}

describe('Stripe Webhook Handler', () => {
  it('should verify webhook signature', async () => {
    const testEnv = {
      ...env,
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_test',
    };

    // Set up rejection for signature verification
    mockStripeWebhooksConstructEvent.mockReset();
    mockStripeWebhooksConstructEvent.mockRejectedValueOnce(new Error('Invalid signature'));

    // Verify the error was thrown (domain error will have code property)
    try {
      await handleWebhook(testEnv, 'raw-body', 'invalid-signature');
      expect.fail('Should have thrown an error');
    } catch (error) {
      // Domain error will have code property, regular error will have message
      expect(error.code || error.message).toBeDefined();
      if (error.code) {
        expect(error.code).toMatch(/AUTH_INVALID/);
      } else if (error.message) {
        expect(error.message).toMatch(/signature/i);
      }
    }
  });

  it('should handle checkout.session.completed event', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const subscriptionData = {
      id: 'sub_checkout',
      status: 'active',
      current_period_start: nowSec,
      current_period_end: nowSec + 86400 * 30,
      cancel_at_period_end: false,
      items: {
        data: [
          {
            price: {
              id: 'price_pro_monthly',
            },
          },
        ],
      },
    };

    mockStripeSubscriptionsRetrieve.mockResolvedValueOnce(subscriptionData);

    const sessionData = {
      id: 'cs_test',
      customer: 'cus_test',
      subscription: 'sub_checkout',
      metadata: {
        userId: 'user-1',
        tier: 'pro',
      },
    };

    // Need to set up the mock before createWebhookRequest since it sets up constructEventAsync
    const testEnv = {
      ...env,
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_test',
    };

    const event = {
      id: 'evt_test',
      type: 'checkout.session.completed',
      data: {
        object: sessionData,
      },
    };

    mockStripeWebhooksConstructEvent.mockResolvedValueOnce(event);

    const result = await handleWebhook(testEnv, 'raw-body', 'valid-signature');

    expect(result.received).toBe(true);
    expect(mockStripeSubscriptionsRetrieve).toHaveBeenCalledWith('sub_checkout');

    // Verify subscription was created
    const subscription = await env.DB.prepare('SELECT * FROM subscriptions WHERE userId = ?1')
      .bind('user-1')
      .first();
    expect(subscription).toBeDefined();
    expect(subscription.tier).toBe('pro');
  });

  it('should handle customer.subscription.created event', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const subscriptionData = {
      id: 'sub_created',
      status: 'active',
      current_period_start: nowSec,
      current_period_end: nowSec + 86400 * 30,
      cancel_at_period_end: false,
      items: {
        data: [
          {
            price: {
              id: 'price_pro_monthly',
            },
          },
        ],
      },
    };

    const { testEnv } = await createWebhookRequest(
      'customer.subscription.created',
      subscriptionData,
    );

    const result = await handleWebhook(testEnv, 'raw-body', 'valid-signature');

    expect(result.received).toBe(true);
  });

  it('should handle customer.subscription.updated event', async () => {
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
      stripeSubscriptionId: 'sub_updated',
      currentPeriodStart: nowSec,
      currentPeriodEnd: nowSec + 86400 * 30,
      cancelAtPeriodEnd: 0,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const subscriptionData = {
      id: 'sub_updated',
      status: 'active',
      current_period_start: nowSec,
      current_period_end: nowSec + 86400 * 60,
      cancel_at_period_end: false,
      items: {
        data: [
          {
            price: {
              id: 'price_team_monthly',
            },
          },
        ],
      },
    };

    const { testEnv } = await createWebhookRequest(
      'customer.subscription.updated',
      subscriptionData,
    );

    const result = await handleWebhook(testEnv, 'raw-body', 'valid-signature');

    expect(result.received).toBe(true);

    // Verify subscription was updated using Drizzle (same as webhook handler)
    const db = createDb(env.DB);
    const subscription = await getSubscriptionByStripeSubscriptionId(db, 'sub_updated');
    expect(subscription).toBeDefined();
    expect(subscription.tier).toBe('team');
  });

  it('should handle customer.subscription.deleted event', async () => {
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
      stripeSubscriptionId: 'sub_deleted',
      currentPeriodStart: nowSec,
      currentPeriodEnd: nowSec + 86400 * 30,
      cancelAtPeriodEnd: 0,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const subscriptionData = {
      id: 'sub_deleted',
      status: 'canceled',
    };

    const { testEnv } = await createWebhookRequest(
      'customer.subscription.deleted',
      subscriptionData,
    );

    const result = await handleWebhook(testEnv, 'raw-body', 'valid-signature');

    expect(result.received).toBe(true);

    // Verify subscription was canceled using Drizzle (same as webhook handler)
    const db = createDb(env.DB);
    const subscription = await getSubscriptionByStripeSubscriptionId(db, 'sub_deleted');
    expect(subscription).toBeDefined();
    expect(subscription.status).toBe('canceled');
    expect(subscription.tier).toBe('free');
  });

  it('should handle invoice.paid event', async () => {
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
      status: 'past_due',
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_invoice_paid',
      currentPeriodStart: nowSec,
      currentPeriodEnd: nowSec + 86400 * 30,
      cancelAtPeriodEnd: 0,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const invoiceData = {
      id: 'in_test',
      subscription: 'sub_invoice_paid',
      paid: true,
    };

    const { testEnv } = await createWebhookRequest('invoice.paid', invoiceData);

    const result = await handleWebhook(testEnv, 'raw-body', 'valid-signature');

    expect(result.received).toBe(true);

    // Verify subscription status was updated using Drizzle (same as webhook handler)
    const db = createDb(env.DB);
    const subscription = await getSubscriptionByStripeSubscriptionId(db, 'sub_invoice_paid');
    expect(subscription).toBeDefined();
    expect(subscription.status).toBe('active');
  });

  it('should handle invoice.payment_failed event', async () => {
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
      stripeSubscriptionId: 'sub_invoice_failed',
      currentPeriodStart: nowSec,
      currentPeriodEnd: nowSec + 86400 * 30,
      cancelAtPeriodEnd: 0,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const invoiceData = {
      id: 'in_test',
      subscription: 'sub_invoice_failed',
      paid: false,
    };

    const { testEnv } = await createWebhookRequest('invoice.payment_failed', invoiceData);

    const result = await handleWebhook(testEnv, 'raw-body', 'valid-signature');

    expect(result.received).toBe(true);

    // Verify subscription status was updated using Drizzle (same as webhook handler)
    const db = createDb(env.DB);
    const subscription = await getSubscriptionByStripeSubscriptionId(db, 'sub_invoice_failed');
    expect(subscription).toBeDefined();
    expect(subscription.status).toBe('past_due');
  });

  it('should ignore unhandled event types', async () => {
    const { testEnv } = await createWebhookRequest('customer.created', {});

    const result = await handleWebhook(testEnv, 'raw-body', 'valid-signature');

    expect(result.received).toBe(true);
  });
});
