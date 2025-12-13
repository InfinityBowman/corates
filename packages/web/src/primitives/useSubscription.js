/**
 * useSubscription primitive
 * Manages subscription state and provides permission helpers
 */

import { createResource, createMemo } from 'solid-js';
import { getSubscription } from '@/api/billing.js';

/**
 * Tier hierarchy for permission checks
 */
const TIER_LEVELS = {
  free: 0,
  pro: 1,
  team: 2,
  enterprise: 3,
};

/**
 * Feature access by tier
 */
const FEATURE_ACCESS = {
  'unlimited-projects': ['pro', 'team', 'enterprise'],
  'advanced-analytics': ['pro', 'team', 'enterprise'],
  'team-collaboration': ['team', 'enterprise'],
  'priority-support': ['team', 'enterprise'],
  sso: ['enterprise'],
  'custom-branding': ['enterprise'],
  'dedicated-support': ['enterprise'],
};

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
   * Check if user has minimum tier access
   * @param {string} requiredTier - Minimum required tier
   * @returns {boolean}
   */
  const hasMinimumTier = requiredTier => {
    const userLevel = TIER_LEVELS[tier()] ?? 0;
    const requiredLevel = TIER_LEVELS[requiredTier] ?? 0;
    return userLevel >= requiredLevel;
  };

  /**
   * Check if user has access to a specific feature
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  const canAccess = feature => {
    const allowedTiers = FEATURE_ACCESS[feature];
    if (!allowedTiers) return true; // Feature not gated
    return allowedTiers.includes(tier());
  };

  /**
   * Check if user is on Pro tier or higher
   */
  const isPro = createMemo(() => hasMinimumTier('pro'));

  /**
   * Check if user is on Team tier or higher
   */
  const isTeam = createMemo(() => hasMinimumTier('team'));

  /**
   * Check if user is on Enterprise tier
   */
  const isEnterprise = createMemo(() => tier() === 'enterprise');

  /**
   * Check if user is on free tier
   */
  const isFree = createMemo(() => tier() === 'free');

  /**
   * Whether the subscription is set to cancel at period end
   */
  const willCancel = createMemo(() => subscription()?.cancelAtPeriodEnd ?? false);

  /**
   * Formatted renewal/expiration date
   */
  const periodEndDate = createMemo(() => {
    const endDate = subscription()?.currentPeriodEnd;
    if (!endDate) return null;
    return new Date(endDate).toLocaleDateString('en-US', {
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
    hasMinimumTier,
    canAccess,
    isPro,
    isTeam,
    isEnterprise,
    isFree,

    // Subscription details
    willCancel,
    periodEndDate,
    stripeSubscriptionId: () => subscription()?.stripeSubscriptionId,
  };
}
