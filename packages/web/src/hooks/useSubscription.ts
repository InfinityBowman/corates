/**
 * useSubscription - Manages subscription state and provides permission helpers
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  isSubscriptionActive,
  hasEntitlement as checkEntitlement,
  getEffectiveEntitlements,
  getEffectiveQuotas,
  hasQuota as checkQuota,
} from '@/lib/entitlements';
import { useAuthStore, selectIsLoggedIn } from '@/stores/authStore';
import { getSubscription } from '@/server/functions/billing.functions';

export type Subscription = Awaited<ReturnType<typeof getSubscription>>;

const DEFAULT_SUBSCRIPTION: Subscription = {
  tier: 'free',
  status: 'active',
  tierInfo: { name: 'Free', description: 'Plan: Free' },
  stripeSubscriptionId: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  accessMode: 'free',
  source: 'free',
  projectCount: 0,
};

export function useSubscription() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.subscription.current,
    queryFn: () => getSubscription(),
    enabled: isLoggedIn,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // refetchOnWindowFocus: true (above) handles visibility change refetching natively

  const subscription = query.data ?? DEFAULT_SUBSCRIPTION;

  const subscriptionFetchFailed = isLoggedIn && query.isError;
  const tier = subscription.tier;
  const status = subscription.status;
  const willCancel = subscription.cancelAtPeriodEnd;
  const hasActiveAccess = isSubscriptionActive(subscription);
  const entitlements = getEffectiveEntitlements(subscription);
  const quotas = getEffectiveQuotas(subscription);

  const periodEndDate = (() => {
    const endDate = subscription.currentPeriodEnd;
    if (!endDate) return null;
    const timestamp = typeof endDate === 'number' ? endDate : parseInt(String(endDate));
    const date = timestamp > 1000000000000 ? new Date(timestamp) : new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  })();

  return {
    subscription,
    loading: query.isPending && !query.data,
    isFetching: query.isFetching,
    error: query.error,
    subscriptionFetchFailed,

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
