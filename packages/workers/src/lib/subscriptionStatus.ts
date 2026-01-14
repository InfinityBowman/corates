/**
 * Shared subscription status utilities
 *
 * Provides unified logic for determining if a subscription is active.
 */

export interface SubscriptionStatusInput {
  status: string;
  periodEnd?: Date | number | null;
  currentPeriodEnd?: Date | number | null;
  cancelAtPeriodEnd?: boolean | null;
}

export interface IsActiveOptions {
  /** Include 'trialing' status as active (default: false) */
  includeTrial?: boolean;
  /** Include 'past_due' status as active within period (default: false) */
  includePastDue?: boolean;
}

/**
 * Determines if a subscription is currently active.
 *
 * @param subscription - The subscription record to check
 * @param now - Current timestamp (Date or unix seconds). Defaults to Date.now()
 * @param options - Configuration for which statuses to include
 * @returns true if the subscription is considered active
 *
 * @example
 * // Basic check (only 'active' status)
 * isSubscriptionActive(sub)
 *
 * @example
 * // Include trialing subscriptions (for billing/features)
 * isSubscriptionActive(sub, Date.now(), { includeTrial: true })
 *
 * @example
 * // Include past_due within grace period (for billing)
 * isSubscriptionActive(sub, Date.now(), { includeTrial: true, includePastDue: true })
 */
export function isSubscriptionActive(
  subscription: SubscriptionStatusInput | null,
  now: Date | number = Date.now(),
  options: IsActiveOptions = {},
): boolean {
  if (!subscription) return false;

  const { includeTrial = false, includePastDue = false } = options;

  const nowTimestamp = now instanceof Date ? Math.floor(now.getTime() / 1000) : now;
  const status = subscription.status;

  // Support both 'periodEnd' and 'currentPeriodEnd' field names
  const rawPeriodEnd = subscription.periodEnd ?? subscription.currentPeriodEnd;
  const periodEnd =
    rawPeriodEnd ?
      rawPeriodEnd instanceof Date ?
        Math.floor(rawPeriodEnd.getTime() / 1000)
      : rawPeriodEnd
    : null;

  // Trialing subscriptions are active if includeTrial is true
  if (status === 'trialing') {
    return includeTrial;
  }

  // Active subscriptions
  if (status === 'active') {
    // If canceled at period end, check if still within period
    if (subscription.cancelAtPeriodEnd && periodEnd) {
      return nowTimestamp < periodEnd;
    }
    return true;
  }

  // Past due subscriptions have a grace period if includePastDue is true
  if (status === 'past_due' && includePastDue) {
    if (!periodEnd) return false;
    return nowTimestamp < periodEnd;
  }

  return false;
}
