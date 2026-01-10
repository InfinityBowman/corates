/**
 * useSubscription primitive
 * Manages subscription state and provides permission helpers
 * Relies on TanStack Query for caching and IndexedDB persistence (via queryClient.js)
 */

import { createMemo, onCleanup } from 'solid-js';
import { useQuery, useQueryClient } from '@tanstack/solid-query';
import { queryKeys } from '@lib/queryKeys.js';
import { apiFetch } from '@/lib/apiFetch.js';
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
 */
async function fetchSubscription() {
  return apiFetch.get('/api/billing/subscription', { toastMessage: false });
}

/**
 * Hook to manage subscription state and permissions
 * @returns {Object} Subscription state and helper functions
 */
export function useSubscription() {
  const { isLoggedIn } = useBetterAuth();
  const queryClient = useQueryClient();

  // Use TanStack Query for subscription data
  // TanStack Query handles caching and IndexedDB persistence automatically
  const query = useQuery(() => ({
    queryKey: queryKeys.subscription.current,
    queryFn: fetchSubscription,
    enabled: isLoggedIn(),
    staleTime: 1000 * 60 * 2, // 2 minutes - data considered fresh
    gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache for offline access
    retry: 1,
    refetchOnWindowFocus: true, // Refetch when tab becomes active
    refetchOnReconnect: true, // Refetch when network reconnects
  }));

  // Also refetch on visibility change (for plan changes in another tab/window)
  if (typeof window !== 'undefined') {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isLoggedIn()) {
        query.refetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    onCleanup(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    });
  }

  // Use query data or default
  const subscription = () => query.data ?? DEFAULT_SUBSCRIPTION;

  // Track if we're using stale/cached data
  const isUsingCachedData = createMemo(() => {
    return isLoggedIn() && query.isStale && !query.isFetching;
  });

  // Get formatted last synced time from query's dataUpdatedAt
  const lastSynced = createMemo(() => {
    const timestamp = query.dataUpdatedAt;
    if (!timestamp) return null;

    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  });

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

  return {
    // Query state
    subscription,
    // Only show loading when no cached data exists (local-first principle)
    loading: () => query.isPending && !query.data,
    isFetching: () => query.isFetching,
    error: () => query.error,
    subscriptionFetchFailed,
    isUsingCachedData,
    lastSynced,

    // Force fresh data from server (removes cache and refetches)
    refetch: async () => {
      // resetQueries removes cached data AND refetches, so UI shows loading state
      const result = await queryClient.resetQueries({ queryKey: queryKeys.subscription.current });
      return result;
    },

    // Optimistic update
    mutate: data => {
      queryClient.setQueryData(queryKeys.subscription.current, data);
    },

    // Clear subscription cache (for logout)
    clearCache: () => {
      queryClient.removeQueries({ queryKey: queryKeys.subscription.current });
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
