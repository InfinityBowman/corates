/**
 * Entitlement and quota computation (frontend)
 * Computes effective entitlements and quotas from subscription at request time
 */

import {
  getPlan,
  DEFAULT_PLAN,
  isUnlimitedQuota,
  getGrantPlan,
  type Entitlements,
  type Quotas,
  type Plan,
} from '@corates/shared/plans';
import { type Subscription } from '@/hooks/useSubscription';

const GRANT_TYPES = ['trial', 'single_project'];

function resolvePlan(planId: string): Plan {
  if (GRANT_TYPES.includes(planId)) {
    return getGrantPlan(planId as 'trial' | 'single_project');
  }
  return getPlan(planId);
}

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

export function isSubscriptionActive(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  if (!ACTIVE_STATUSES.includes(subscription.status)) return false;
  if (!subscription.currentPeriodEnd) return true;
  const now = Math.floor(Date.now() / 1000);

  const endTime =
    typeof subscription.currentPeriodEnd === 'number'
      ? subscription.currentPeriodEnd
      : parseInt(String(subscription.currentPeriodEnd));
  return endTime > now;
}

export function getEffectiveEntitlements(subscription: Subscription | null): Entitlements {
  const planId = subscription?.tier || DEFAULT_PLAN;
  const plan = resolvePlan(planId);
  if (!isSubscriptionActive(subscription)) {
    return getPlan(DEFAULT_PLAN).entitlements;
  }
  return plan.entitlements;
}

export function getEffectiveQuotas(subscription: Subscription | null): Quotas {
  const planId = subscription?.tier || DEFAULT_PLAN;
  const plan = resolvePlan(planId);
  if (!isSubscriptionActive(subscription)) {
    return getPlan(DEFAULT_PLAN).quotas;
  }
  return plan.quotas;
}

export function hasEntitlement(subscription: Subscription | null, entitlement: string): boolean {
  const entitlements = getEffectiveEntitlements(subscription);
  return (entitlements as unknown as Record<string, boolean>)[entitlement] === true;
}

export function hasQuota(
  subscription: Subscription | null,
  quotaKey: string,
  { used, requested = 1 }: { used: number; requested?: number },
): boolean {
  const quotas = getEffectiveQuotas(subscription);
  const limit = quotas[quotaKey];
  if (isUnlimitedQuota(limit)) return true;
  return used + requested <= limit;
}
