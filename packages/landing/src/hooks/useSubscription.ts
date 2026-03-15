/**
 * useSubscription - Manages subscription state and provides permission helpers
 */

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys.js';
import { apiFetch } from '@/lib/apiFetch';
import { hasActiveAccess as checkActiveAccess } from '@/lib/access.js';
import {
  hasEntitlement as checkEntitlement,
  getEffectiveEntitlements,
  getEffectiveQuotas,
  hasQuota as checkQuota,
} from '@/lib/entitlements.js';
import { useAuthStore, selectIsLoggedIn } from '@/stores/authStore';

export interface Subscription {
  tier: string;
  status: string;
  tierInfo: { name: string; description: string };
  stripeSubscriptionId: string | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
}

const DEFAULT_SUBSCRIPTION: Subscription = {
  tier: 'free',
  status: 'active',
  tierInfo: { name: 'Free', description: 'For individuals getting started' },
  stripeSubscriptionId: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

async function fetchSubscription(): Promise<Subscription> {
  return apiFetch.get<Subscription>('/api/billing/subscription', { toastMessage: false });
}

export function useSubscription() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.subscription.current,
    queryFn: fetchSubscription,
    enabled: isLoggedIn,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // refetchOnWindowFocus: true (above) handles visibility change refetching natively

  const subscription = query.data ?? DEFAULT_SUBSCRIPTION;

  const isUsingCachedData = isLoggedIn && query.isStale && !query.isFetching;

  // Computed on-demand rather than during render (avoids impure Date.now() in render)
  function getLastSynced(): string | null {
    const timestamp = query.dataUpdatedAt;
    if (!timestamp) return null;
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  const subscriptionFetchFailed = isLoggedIn && query.isError;
  const tier = subscription.tier;
  const status = subscription.status;
  const isActive = status === 'active' || status === 'trialing';
  const willCancel = subscription.cancelAtPeriodEnd;
  const hasActiveAccess = checkActiveAccess(subscription);
  const entitlements = useMemo(() => getEffectiveEntitlements(subscription), [subscription]);
  const quotas = useMemo(() => getEffectiveQuotas(subscription), [subscription]);

  const periodEndDate = useMemo(() => {
    const endDate = subscription.currentPeriodEnd;
    if (!endDate) return null;
    const timestamp = typeof endDate === 'number' ? endDate : parseInt(String(endDate));
    const date = timestamp > 1000000000000 ? new Date(timestamp) : new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }, [subscription]);

  return {
    subscription,
    loading: query.isPending && !query.data,
    isFetching: query.isFetching,
    error: query.error,
    subscriptionFetchFailed,
    isUsingCachedData,
    getLastSynced,

    refetch: async () => {
      return queryClient.resetQueries({ queryKey: queryKeys.subscription.current });
    },
    mutate: (data: Subscription) => {
      queryClient.setQueryData(queryKeys.subscription.current, data);
    },
    clearCache: () => {
      queryClient.removeQueries({ queryKey: queryKeys.subscription.current });
    },

    tier,
    tierInfo: subscription.tierInfo,
    status,
    isActive,
    hasActiveAccess,
    entitlements,
    quotas,
    hasEntitlement: (entitlement: string) => checkEntitlement(subscription, entitlement),
    hasQuota: (quotaKey: string, opts: { used: number; requested?: number }) =>
      checkQuota(subscription, quotaKey, opts),
    willCancel,
    periodEndDate,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
  };
}
