/**
 * useSubscription primitive
 * Manages subscription state and provides permission helpers
 */

import { createResource, createMemo } from 'solid-js';
import { getSubscription } from '@/api/billing.js';
import { hasActiveAccess as checkActiveAccess } from '@/lib/access.js';
import {
  hasEntitlement as checkEntitlement,
  getEffectiveEntitlements,
  getEffectiveQuotas,
  hasQuota as checkQuota,
} from '@/lib/entitlements.js';

/**
 * Hook to manage subscription state and permissions
 * @returns {Object} Subscription state and helper functions
 */
export function useSubscription() {
  const [subscription, { refetch, mutate }] = createResource(getSubscription, {
    initialValue: {
      tier: 'free',
      status: 'active',
      tierInfo: { name: 'Free', description: 'For individuals getting started' },
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
  });

  /**
   * Current subscription tier
   */
  const tier = createMemo(() => subscription()?.tier ?? 'free');

  /**
   * Whether the subscription is active
   */
  const isActive = createMemo(() => {
    const status = subscription()?.status;
    return status === 'active' || status === 'trialing';
  });

  /**
   * Whether the subscription is set to cancel at period end
   */
  const willCancel = createMemo(() => subscription()?.cancelAtPeriodEnd ?? false);

  /**
   * Check if user has active access (time-limited access check)
   */
  const hasActiveAccess = createMemo(() => checkActiveAccess(subscription()));

  /**
   * Effective entitlements for the user
   */
  const entitlements = createMemo(() => getEffectiveEntitlements(subscription()));

  /**
   * Effective quotas for the user
   */
  const quotas = createMemo(() => getEffectiveQuotas(subscription()));

  /**
   * Check if user has a specific entitlement
   * @param {string} entitlement - Entitlement key (e.g., 'project.create')
   * @returns {boolean}
   */
  const hasEntitlement = entitlement => checkEntitlement(subscription(), entitlement);

  /**
   * Check if user has quota available
   * @param {string} quotaKey - Quota key (e.g., 'projects.max')
   * @param {Object} options - Options object
   * @param {number} options.used - Current usage
   * @param {number} [options.requested=1] - Additional amount requested
   * @returns {boolean}
   */
  const hasQuota = (quotaKey, { used, requested = 1 }) =>
    checkQuota(subscription(), quotaKey, { used, requested });

  /**
   * Formatted renewal/expiration date
   */
  const periodEndDate = createMemo(() => {
    const endDate = subscription()?.currentPeriodEnd;
    if (!endDate) return null;
    // Handle both seconds and milliseconds timestamps
    const timestamp = typeof endDate === 'number' ? endDate : parseInt(endDate);
    const date = timestamp > 1000000000000 ? new Date(timestamp) : new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  });

  return {
    // Resource
    subscription,
    loading: () => subscription.loading,
    error: () => subscription.error,
    refetch,
    mutate,

    // Tier info
    tier,
    tierInfo: () => subscription()?.tierInfo,
    status: () => subscription()?.status,

    // Permission checks
    isActive,
    hasActiveAccess,

    // Entitlements and quotas
    entitlements,
    quotas,
    hasEntitlement,
    hasQuota,

    // Subscription details
    willCancel,
    periodEndDate,
    stripeSubscriptionId: () => subscription()?.stripeSubscriptionId,
  };
}
