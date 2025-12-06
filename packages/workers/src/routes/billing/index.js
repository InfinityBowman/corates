/**
 * Billing routes for Hono
 * Handles Stripe checkout, portal, and subscription management
 */

import { Hono } from 'hono';
import { requireAuth, getAuth } from '../../middleware/auth.js';
import { createDb } from '../../db/client.js';
import { getSubscriptionByUserId } from '../../db/subscriptions.js';
import { createCheckoutSession } from './checkout.js';
import { createPortalSession } from './portal.js';
import { handleWebhook } from './webhooks.js';
import { TIER_INFO, PRICE_IDS } from '../../config/stripe.js';

const billingRoutes = new Hono();

/**
 * GET /api/billing/subscription
 * Get the current user's subscription
 */
billingRoutes.get('/subscription', requireAuth, async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    const subscription = await getSubscriptionByUserId(db, user.id);

    if (!subscription) {
      // Return default free tier info
      return c.json({
        tier: 'free',
        status: 'active',
        tierInfo: TIER_INFO.free,
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    return c.json({
      tier: subscription.tier,
      status: subscription.status,
      tierInfo: TIER_INFO[subscription.tier] ?? TIER_INFO.free,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return c.json({ error: 'Failed to fetch subscription' }, 500);
  }
});

/**
 * GET /api/billing/plans
 * Get available subscription plans
 */
billingRoutes.get('/plans', async c => {
  // Return available plans with pricing info
  // In production, you might fetch this from Stripe
  return c.json({
    plans: [
      {
        tier: 'free',
        ...TIER_INFO.free,
        price: { monthly: 0, yearly: 0 },
        features: ['Basic features', 'Limited projects', 'Community support'],
      },
      {
        tier: 'pro',
        ...TIER_INFO.pro,
        price: { monthly: 15, yearly: 144 }, // TODO: Update with actual prices
        priceIds: PRICE_IDS.pro,
        features: [
          'Everything in Free',
          'Unlimited projects',
          'Advanced analytics',
          'Email support',
        ],
      },
      {
        tier: 'team',
        ...TIER_INFO.team,
        price: { monthly: 30, yearly: 288 }, // TODO: Update with actual prices
        priceIds: PRICE_IDS.team,
        features: [
          'Everything in Pro',
          'Team collaboration',
          'Role-based access',
          'Priority support',
        ],
      },
      {
        tier: 'enterprise',
        ...TIER_INFO.enterprise,
        price: { monthly: null, yearly: null }, // Contact sales
        priceIds: PRICE_IDS.enterprise,
        features: ['Everything in Team', 'SSO', 'Custom branding', 'Dedicated support'],
      },
    ],
  });
});

/**
 * POST /api/billing/checkout
 * Create a Stripe Checkout session
 */
billingRoutes.post('/checkout', requireAuth, async c => {
  const { user } = getAuth(c);

  try {
    const body = await c.req.json();
    const { tier, interval = 'monthly' } = body;

    if (!tier || tier === 'free') {
      return c.json({ error: 'Invalid tier selection' }, 400);
    }

    const result = await createCheckoutSession(c.env, user, tier, interval);
    return c.json(result);
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
});

/**
 * POST /api/billing/portal
 * Create a Stripe Customer Portal session
 */
billingRoutes.post('/portal', requireAuth, async c => {
  const { user } = getAuth(c);

  try {
    const result = await createPortalSession(c.env, user);
    return c.json(result);
  } catch (error) {
    console.error('Error creating portal session:', error);
    return c.json({ error: 'Failed to create portal session' }, 500);
  }
});

/**
 * POST /api/billing/webhook
 * Handle Stripe webhook events
 */
billingRoutes.post('/webhook', async c => {
  try {
    const signature = c.req.header('stripe-signature');
    const rawBody = await c.req.text();

    if (!signature) {
      return c.json({ error: 'Missing signature' }, 400);
    }

    const result = await handleWebhook(c.env, rawBody, signature);
    return c.json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 400);
  }
});

export { billingRoutes };
