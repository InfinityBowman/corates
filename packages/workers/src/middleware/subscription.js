/**
 * Subscription middleware for Hono
 * Provides tier-based access control for protected routes
 */

import { createDb } from '../db/client.js';
import { getSubscriptionByUserId } from '../db/subscriptions.js';
import { hasMinimumTier, hasFeatureAccess } from '../config/stripe.js';
import { getAuth } from './auth.js';
import { DEFAULT_SUBSCRIPTION_TIER, ACTIVE_STATUSES } from '../config/constants.js';

/**
 * Middleware that requires a minimum subscription tier
 * Must be used after requireAuth middleware
 * @param {string} minTier - Minimum required tier ('free', 'pro', 'team', 'enterprise')
 * @returns {Function} Hono middleware
 */
export function requireTier(minTier) {
  return async (c, next) => {
    const { user } = getAuth(c);

    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const db = createDb(c.env.DB);
    const subscription = await getSubscriptionByUserId(db, user.id);
    const userTier = subscription?.tier ?? DEFAULT_SUBSCRIPTION_TIER;

    // Check if subscription is active
    if (subscription && !ACTIVE_STATUSES.includes(subscription.status)) {
      return c.json(
        {
          error: 'Subscription inactive',
          status: subscription.status,
          message: 'Please update your payment method or reactivate your subscription',
        },
        403,
      );
    }

    // Check tier level
    if (!hasMinimumTier(userTier, minTier)) {
      return c.json(
        {
          error: 'Upgrade required',
          currentTier: userTier,
          requiredTier: minTier,
          message: `This feature requires a ${minTier} subscription or higher`,
        },
        403,
      );
    }

    // Attach subscription to context for downstream use
    c.set('subscription', subscription);
    c.set('tier', userTier);

    await next();
  };
}

/**
 * Middleware that requires access to a specific feature
 * Must be used after requireAuth middleware
 * @param {string} feature - Feature name to check
 * @returns {Function} Hono middleware
 */
export function requireFeature(feature) {
  return async (c, next) => {
    const { user } = getAuth(c);

    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const db = createDb(c.env.DB);
    const subscription = await getSubscriptionByUserId(db, user.id);
    const userTier = subscription?.tier ?? DEFAULT_SUBSCRIPTION_TIER;

    // Check if subscription is active
    if (subscription && !ACTIVE_STATUSES.includes(subscription.status)) {
      return c.json(
        {
          error: 'Subscription inactive',
          status: subscription.status,
        },
        403,
      );
    }

    // Check feature access
    if (!hasFeatureAccess(userTier, feature)) {
      return c.json(
        {
          error: 'Feature not available',
          feature,
          currentTier: userTier,
          message: `This feature is not available on your current plan`,
        },
        403,
      );
    }

    // Attach subscription to context
    c.set('subscription', subscription);
    c.set('tier', userTier);

    await next();
  };
}

/**
 * Get the subscription from context (after middleware has run)
 * @param {Object} c - Hono context
 * @returns {{ subscription: Object|null, tier: string }}
 */
export function getSubscription(c) {
  return {
    subscription: c.get('subscription') ?? null,
    tier: c.get('tier') ?? DEFAULT_SUBSCRIPTION_TIER,
  };
}
