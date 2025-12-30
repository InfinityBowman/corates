/**
 * useSubscription primitive
 * Manages subscription state and provides permission helpers
 */

import { createMemo } from 'solid-js';
import { useQuery, useQueryClient } from '@tanstack/solid-query';
import { API_BASE } from '@config/api.js';
import { queryKeys } from '@lib/queryKeys.js';
import { handleFetchError } from '@/lib/error-utils.js';
import { hasActiveAccess as checkActiveAccess } from '@/lib/access.js';
import {
  hasEntitlement as checkEntitlement,
  getEffectiveEntitlements,
  getEffectiveQuotas,
  hasQuota as checkQuota,
} from '@/lib/entitlements.js';
import { useBetterAuth } from '@/api/better-auth-store.js';

const DEFAULT_SUBSCRIPTION = {
  tier: 'free',
  status: 'active',
  tierInfo: { name: 'Free', description: 'For individuals getting started' },
  stripeSubscriptionId: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

/**
 * Fetch subscription from API
 * Throws on error instead of silently returning default
 */
async function fetchSubscription() {
  const response = await handleFetchError(
    fetch(`${API_BASE}/api/billing/subscription`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'GET',
    }),
    { showToast: false },
  );
  return response.json();
}

/**
 * Hook to manage subscription state and permissions
 * @returns {Object} Subscription state and helper functions
 */
export function useSubscription() {
  const { isLoggedIn } = useBetterAuth();

  // Use TanStack Query for subscription data with persistence
  const query = useQuery(() => ({
    queryKey: queryKeys.subscription.current,
    queryFn: fetchSubscription,
    enabled: isLoggedIn(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 1, // Retry once on failure
    // Use placeholderData so components can check loading state
    // placeholderData is only used while loading, not as initial data
    placeholderData: undefined,
  }));

  // Return default subscription when not logged in or when query fails
  // This prevents breaking the UI while still exposing the error for components that care
  const subscription = () => query.data || DEFAULT_SUBSCRIPTION;

  /**
   * Whether subscription fetch failed (only meaningful when logged in)
   */
  const subscriptionFetchFailed = createMemo(() => isLoggedIn() && query.isError);

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

  const queryClient = useQueryClient();

  return {
    // Query state
    subscription,
    loading: () => query.isLoading || query.isFetching,
    error: () => query.error,
    subscriptionFetchFailed, // True when logged in and fetch failed
    refetch: () => query.refetch(),
    mutate: data => {
      // Optimistic update - set query data via queryClient
      queryClient.setQueryData(queryKeys.subscription.current, data);
    },

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
