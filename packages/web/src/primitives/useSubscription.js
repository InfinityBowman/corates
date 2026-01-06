/**
 * useSubscription primitive
 * Manages subscription state and provides permission helpers
 * Uses localStorage for local-first persistence during bad connections
 */

import { createMemo, onCleanup } from 'solid-js';
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

// LocalStorage keys for offline caching
const SUBSCRIPTION_CACHE_KEY = 'corates-subscription-cache';
const SUBSCRIPTION_CACHE_TIMESTAMP_KEY = 'corates-subscription-cache-timestamp';
const SUBSCRIPTION_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const DEFAULT_SUBSCRIPTION = {
  tier: 'free',
  status: 'active',
  tierInfo: { name: 'Free', description: 'For individuals getting started' },
  stripeSubscriptionId: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

/**
 * Load cached subscription from localStorage
 * @returns {Object|null} Cached subscription or null
 */
function loadCachedSubscription() {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(SUBSCRIPTION_CACHE_KEY);
    const timestamp = localStorage.getItem(SUBSCRIPTION_CACHE_TIMESTAMP_KEY);
    if (!cached || !timestamp) return null;

    const age = Date.now() - parseInt(timestamp, 10);
    if (age > SUBSCRIPTION_CACHE_MAX_AGE) {
      localStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
      localStorage.removeItem(SUBSCRIPTION_CACHE_TIMESTAMP_KEY);
      return null;
    }

    return JSON.parse(cached);
  } catch (err) {
    console.error('Error loading cached subscription:', err);
    return null;
  }
}

/**
 * Save subscription to localStorage
 * @param {Object|null} subscription - Subscription data to cache
 */
function saveCachedSubscription(subscription) {
  if (typeof window === 'undefined') return;
  try {
    if (subscription && subscription.tier) {
      localStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(subscription));
      localStorage.setItem(SUBSCRIPTION_CACHE_TIMESTAMP_KEY, Date.now().toString());
    }
  } catch (err) {
    console.error('Error saving cached subscription:', err);
  }
}

/**
 * Clear cached subscription from localStorage
 */
function clearCachedSubscription() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
    localStorage.removeItem(SUBSCRIPTION_CACHE_TIMESTAMP_KEY);
  } catch (err) {
    console.error('Error clearing cached subscription:', err);
  }
}

/**
 * Get the timestamp of when subscription was last synced
 * @returns {number|null} Timestamp in milliseconds or null
 */
function getLastSyncedTimestamp() {
  if (typeof window === 'undefined') return null;
  try {
    const timestamp = localStorage.getItem(SUBSCRIPTION_CACHE_TIMESTAMP_KEY);
    return timestamp ? parseInt(timestamp, 10) : null;
  } catch {
    return null;
  }
}

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
  const data = await response.json();
  // Cache successful fetch for local-first persistence
  saveCachedSubscription(data);
  return data;
}

/**
 * Hook to manage subscription state and permissions
 * @returns {Object} Subscription state and helper functions
 */
export function useSubscription() {
  const { isLoggedIn } = useBetterAuth();

  // Load cached subscription for local-first fallback
  const cachedSubscription = loadCachedSubscription();

  // Use TanStack Query for subscription data with persistence
  const query = useQuery(() => ({
    queryKey: queryKeys.subscription.current,
    queryFn: fetchSubscription,
    enabled: isLoggedIn(),
    staleTime: 1000 * 60 * 2, // 2 minutes (reduced from 5 for fresher data)
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 1, // Retry once on failure
    // Use cached subscription as initial data for instant display
    initialData: cachedSubscription || undefined,
  }));

  // Refetch subscription when tab becomes visible (handles plan changes in another tab)
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

  // Local-first: use query data, fall back to cached, then default
  // This ensures paid users keep their entitlements during bad connections
  const subscription = () => {
    if (query.data) return query.data;
    if (query.isError && cachedSubscription) return cachedSubscription;
    return DEFAULT_SUBSCRIPTION;
  };

  // Track if we're using cached data (for UI indicators)
  const isUsingCachedData = createMemo(() => {
    return isLoggedIn() && query.isError && cachedSubscription !== null;
  });

  // Get formatted last synced time for UI display
  const lastSynced = createMemo(() => {
    const timestamp = getLastSyncedTimestamp();
    if (!timestamp) return null;
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
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

  const queryClient = useQueryClient();

  return {
    // Query state
    subscription,
    loading: () => query.isLoading || query.isFetching,
    error: () => query.error,
    subscriptionFetchFailed, // True when logged in and fetch failed
    isUsingCachedData, // True when using localStorage fallback
    lastSynced, // Formatted string for when data was last synced
    refetch: () => query.refetch(),
    mutate: data => {
      // Optimistic update - set query data via queryClient
      queryClient.setQueryData(queryKeys.subscription.current, data);
      // Also update cache for local-first persistence
      saveCachedSubscription(data);
    },
    clearCache: clearCachedSubscription, // For logout cleanup

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
