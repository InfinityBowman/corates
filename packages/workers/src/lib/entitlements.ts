import { getPlan, DEFAULT_PLAN, isUnlimitedQuota } from '@corates/shared/plans';
import type { Entitlements, Quotas } from '@corates/shared/plans';

interface Subscription {
  status: string;
  tier?: string;
  currentPeriodEnd?: Date | number | null;
}

export function isSubscriptionActive(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  if (subscription.status !== 'active') return false;
  if (!subscription.currentPeriodEnd) return true;

  const now = Math.floor(Date.now() / 1000);
  const periodEnd =
    subscription.currentPeriodEnd instanceof Date
      ? Math.floor(subscription.currentPeriodEnd.getTime() / 1000)
      : subscription.currentPeriodEnd;

  return periodEnd > now;
}

export function getEffectiveEntitlements(subscription: Subscription | null): Entitlements {
  const planId = subscription?.tier || DEFAULT_PLAN;
  const plan = getPlan(planId);

  if (!isSubscriptionActive(subscription)) {
    return getPlan(DEFAULT_PLAN).entitlements;
  }

  return plan.entitlements;
}

export function getEffectiveQuotas(subscription: Subscription | null): Quotas {
  const planId = subscription?.tier || DEFAULT_PLAN;
  const plan = getPlan(planId);

  if (!isSubscriptionActive(subscription)) {
    return getPlan(DEFAULT_PLAN).quotas;
  }

  return plan.quotas;
}

export function hasEntitlement(subscription: Subscription | null, entitlement: string): boolean {
  const entitlements = getEffectiveEntitlements(subscription);
  return (entitlements as unknown as Record<string, boolean>)[entitlement] === true;
}

interface QuotaOptions {
  used: number;
  requested?: number;
}

export function hasQuota(
  subscription: Subscription | null,
  quotaKey: string,
  { used, requested = 1 }: QuotaOptions,
): boolean {
  const quotas = getEffectiveQuotas(subscription);
  const limit = (quotas as unknown as Record<string, number>)[quotaKey];

  if (isUnlimitedQuota(limit)) return true;

  return used + requested <= limit;
}
