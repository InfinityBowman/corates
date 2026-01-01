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
import { DEFAULT_SUBSCRIPTION_TIER, DEFAULT_SUBSCRIPTION_STATUS } from '../../config/constants.js';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  SYSTEM_ERRORS,
  isDomainError,
} from '@corates/shared';

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
        tier: DEFAULT_SUBSCRIPTION_TIER,
        status: DEFAULT_SUBSCRIPTION_STATUS,
        tierInfo: TIER_INFO.free,
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    // Convert Date objects to Unix timestamps (seconds) for JSON serialization
    // Drizzle timestamp mode returns Date objects, but frontend expects Unix timestamps
    const currentPeriodEnd =
      subscription.currentPeriodEnd instanceof Date ?
        Math.floor(subscription.currentPeriodEnd.getTime() / 1000)
      : subscription.currentPeriodEnd;

    // Normalize tier to lowercase to match TIER_INFO keys
    const tier = (subscription.tier || DEFAULT_SUBSCRIPTION_TIER).trim().toLowerCase();
    const validTier = TIER_INFO[tier] ? tier : DEFAULT_SUBSCRIPTION_TIER;

    return c.json({
      tier: validTier,
      status: subscription.status,
      tierInfo: TIER_INFO[validTier] ?? TIER_INFO.free,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_subscription',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
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

    if (!tier || tier === DEFAULT_SUBSCRIPTION_TIER) {
      const error = createValidationError(
        'tier',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        tier,
        'invalid_tier',
      );
      return c.json(error, error.statusCode);
    }

    const result = await createCheckoutSession(c.env, user, tier, interval);
    return c.json(result);
  } catch (error) {
    console.error('Error creating checkout session:', error);
    // If it's already a domain error, return it directly
    if (isDomainError(error)) {
      return c.json(error, error.statusCode);
    }
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'create_checkout_session',
      originalError: error.message,
    });
    return c.json(systemError, systemError.statusCode);
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
    // If it's already a domain error, return it directly
    if (isDomainError(error)) {
      return c.json(error, error.statusCode);
    }
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'create_portal_session',
      originalError: error.message,
    });
    return c.json(systemError, systemError.statusCode);
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
      const error = createValidationError(
        'signature',
        VALIDATION_ERRORS.FIELD_REQUIRED.code,
        null,
        'required',
      );
      return c.json(error, error.statusCode);
    }

    const result = await handleWebhook(c.env, rawBody, signature);
    return c.json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    // If it's already a domain error, pass it through
    if (isDomainError(error)) {
      return c.json(error, error.statusCode);
    }
    // Only wrap non-domain/unexpected errors
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'process_webhook',
      originalError: error.message,
    });
    return c.json(systemError, systemError.statusCode);
  }
});

export { billingRoutes };
