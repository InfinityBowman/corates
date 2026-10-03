/**
 * useSubscription - Manages subscription state and provides permission helpers
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { QUERY_FRESH } from '@/lib/queryPresets';
import {
  isSubscriptionActive,
  hasEntitlement as checkEntitlement,
  getEffectiveEntitlements,
  getEffectiveQuotas,
  hasQuota as checkQuota,
} from '@/lib/entitlements';
import { useAuthStore, selectIsLoggedIn } from '@/stores/authStore';
import { getSubscription } from '@/server/functions/billing.functions';
import { useOwnedWorkspace } from '@/hooks/useWorkspaces';
import { getPlan, DEFAULT_PLAN } from '@corates/shared/plans';

export type Subscription = Awaited<ReturnType<typeof getSubscription>>;

const DEFAULT_SUBSCRIPTION: Subscription = {
  tier: 'free',
  status: 'active',
  tierInfo: { name: 'Free', description: 'Plan: Free' },
  stripeSubscriptionId: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  interval: null,
  accessMode: 'free',
  source: 'free',
  quotas: getPlan(DEFAULT_PLAN).quotas,
  projectCount: 0,
};

/** A workspace's subscription; defaults to the current workspace. */
export function useSubscription(orgId?: string | null) {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const queryClient = useQueryClient();
  const { workspace } = useOwnedWorkspace();
  const resolvedOrgId = orgId === undefined ? workspace?.id : orgId;
  const queryKey = queryKeys.subscription.byOrg(resolvedOrgId);

  const query = useQuery({
    queryKey,
    queryFn: () => getSubscription({ data: { orgId: resolvedOrgId! } }),
    enabled: isLoggedIn && !!resolvedOrgId,
    ...QUERY_FRESH,
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
    isLoading: query.isPending && !query.data,
    isFetching: query.isFetching,
    error: query.error,
    subscriptionFetchFailed,

    refetch: async () => {
      return queryClient.resetQueries({ queryKey });
    },
    mutate: (data: Subscription) => {
      queryClient.setQueryData(queryKey, data);
    },
    clearCache: () => {
      queryClient.removeQueries({ queryKey });
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
