/**
 * Entitlement and quota computation (frontend)
 * Computes effective entitlements and quotas from subscription at request time
 */

import { getPlan, DEFAULT_PLAN, isUnlimitedQuota, getGrantPlan } from '@corates/shared/plans';

/**
 * Grant types that should use getGrantPlan instead of getPlan
 */
const GRANT_TYPES = ['trial', 'single_project'];

/**
 * Resolve the plan configuration for a given tier/grant type
 * @param {string} planId - Plan ID or grant type
 * @returns {Object} Plan configuration with entitlements and quotas
 */
function resolvePlan(planId) {
  if (GRANT_TYPES.includes(planId)) {
    return getGrantPlan(planId);
  }
  return getPlan(planId);
}

/**
 * Statuses that grant full access to plan features
 */
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

/**
 * Check if subscription is active
 * @param {Object|null} subscription - Subscription object from API
 * @returns {boolean} True if subscription is active
 */
export function isSubscriptionActive(subscription) {
  if (!subscription) return false;
  if (!ACTIVE_STATUSES.includes(subscription.status)) return false;
  if (!subscription.currentPeriodEnd) return true;
  const now = Math.floor(Date.now() / 1000);

  const endTime =
    typeof subscription.currentPeriodEnd === 'number' ?
      subscription.currentPeriodEnd
    : parseInt(subscription.currentPeriodEnd);
  return endTime > now;
}

/**
 * Get effective entitlements for a user
 * @param {Object|null} subscription - Subscription object from API
 * @returns {Object} Entitlements object
 */
export function getEffectiveEntitlements(subscription) {
  const planId = subscription?.tier || DEFAULT_PLAN;
  const plan = resolvePlan(planId);
  if (!isSubscriptionActive(subscription)) {
    return getPlan(DEFAULT_PLAN).entitlements;
  }
  return plan.entitlements;
}

/**
 * Get effective quotas for a user
 * @param {Object|null} subscription - Subscription object from API
 * @returns {Object} Quotas object
 */
export function getEffectiveQuotas(subscription) {
  const planId = subscription?.tier || DEFAULT_PLAN;
  const plan = resolvePlan(planId);
  if (!isSubscriptionActive(subscription)) {
    return getPlan(DEFAULT_PLAN).quotas;
  }
  return plan.quotas;
}

/**
 * Check if user has a specific entitlement
 * @param {Object|null} subscription - Subscription object from API
 * @param {string} entitlement - Entitlement key (e.g., 'project.create')
 * @returns {boolean} True if user has the entitlement
 */
export function hasEntitlement(subscription, entitlement) {
  const entitlements = getEffectiveEntitlements(subscription);
  return entitlements[entitlement] === true;
}

/**
 * Check if user has quota available
 * @param {Object|null} subscription - Subscription object from API
 * @param {string} quotaKey - Quota key (e.g., 'projects.max')
 * @param {Object} options - Options object
 * @param {number} options.used - Current usage
 * @param {number} [options.requested=1] - Additional amount requested
 * @returns {boolean} True if quota allows the request
 */
export function hasQuota(subscription, quotaKey, { used, requested = 1 }) {
  const quotas = getEffectiveQuotas(subscription);
  const limit = quotas[quotaKey];
  if (isUnlimitedQuota(limit)) return true;
  return used + requested <= limit;
}
