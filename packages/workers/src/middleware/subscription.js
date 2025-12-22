/**
 * Subscription middleware for Hono
 * Provides tier-based access control for protected routes
 */
import { DEFAULT_SUBSCRIPTION_TIER } from '../config/constants.js';

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
