/**
 * Entitlement and quota computation
 * Computes effective entitlements and quotas from subscription at request time
 */

import { getPlan, DEFAULT_PLAN } from '@corates/shared/plans';

/**
 * Check if subscription is active
 * @param {Object|null} subscription - Subscription record from database
 * @returns {boolean} True if subscription is active
 */
export function isSubscriptionActive(subscription) {
  if (!subscription) return false;
  if (subscription.status !== 'active') return false;
  if (!subscription.currentPeriodEnd) return true; // No expiration
  const now = Math.floor(Date.now() / 1000);
  return subscription.currentPeriodEnd > now;
}

/**
 * Get effective entitlements for a user
 * Returns entitlements from their plan if subscription is active, otherwise returns free plan entitlements
 * @param {Object|null} subscription - Subscription record from database
 * @returns {Object} Entitlements object
 */
export function getEffectiveEntitlements(subscription) {
  const planId = subscription?.tier || DEFAULT_PLAN;
  const plan = getPlan(planId);

  // If subscription is not active, return free plan entitlements
  if (!isSubscriptionActive(subscription)) {
    return getPlan(DEFAULT_PLAN).entitlements;
  }

  return plan.entitlements;
}

/**
 * Get effective quotas for a user
 * Returns quotas from their plan if subscription is active, otherwise returns free plan quotas
 * @param {Object|null} subscription - Subscription record from database
 * @returns {Object} Quotas object
 */
export function getEffectiveQuotas(subscription) {
  const planId = subscription?.tier || DEFAULT_PLAN;
  const plan = getPlan(planId);

  // If subscription is not active, return free plan quotas
  if (!isSubscriptionActive(subscription)) {
    return getPlan(DEFAULT_PLAN).quotas;
  }

  return plan.quotas;
}

/**
 * Check if user has a specific entitlement
 * @param {Object|null} subscription - Subscription record from database
 * @param {string} entitlement - Entitlement key (e.g., 'project.create')
 * @returns {boolean} True if user has the entitlement
 */
export function hasEntitlement(subscription, entitlement) {
  const entitlements = getEffectiveEntitlements(subscription);
  return entitlements[entitlement] === true;
}

/**
 * Check if user has quota available
 * @param {Object|null} subscription - Subscription record from database
 * @param {string} quotaKey - Quota key (e.g., 'projects.max')
 * @param {Object} options - Options object
 * @param {number} options.used - Current usage
 * @param {number} [options.requested=1] - Additional amount requested
 * @returns {boolean} True if quota allows the request
 */
export function hasQuota(subscription, quotaKey, { used, requested = 1 }) {
  const quotas = getEffectiveQuotas(subscription);
  const limit = quotas[quotaKey];

  // Infinity means unlimited
  if (limit === Infinity) return true;

  // Check if usage + requested exceeds limit
  return used + requested <= limit;
}
