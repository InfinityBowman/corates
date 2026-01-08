/**
 * Subscription status mapping and access resolution
 * Maps Stripe subscription statuses to CoRATES access levels
 */

/**
 * Stripe subscription status to CoRATES access mapping
 * @see https://stripe.com/docs/api/subscriptions/object#subscription_object-status
 */
export const SUBSCRIPTION_STATUS_MAP = {
  // Full access statuses
  active: {
    hasAccess: true,
    accessLevel: 'full',
    description: 'Subscription is active and paid',
  },
  trialing: {
    hasAccess: true,
    accessLevel: 'full',
    description: 'Subscription is in trial period',
  },

  // Grace period statuses (limited time to fix payment)
  past_due: {
    hasAccess: true,
    accessLevel: 'limited',
    gracePeriodDays: 7,
    description: 'Payment failed but within grace period',
  },
  unpaid: {
    hasAccess: true,
    accessLevel: 'limited',
    gracePeriodDays: 3,
    description: 'Invoice unpaid, short grace period',
  },

  // No access statuses
  canceled: {
    hasAccess: false,
    accessLevel: 'none',
    description: 'Subscription has been canceled',
  },
  incomplete: {
    hasAccess: false,
    accessLevel: 'none',
    description: 'Initial payment failed',
  },
  incomplete_expired: {
    hasAccess: false,
    accessLevel: 'none',
    description: 'Initial payment window expired',
  },
  paused: {
    hasAccess: false,
    accessLevel: 'none',
    description: 'Subscription is paused',
  },
};

/**
 * Resolve subscription access based on status and period end
 * @param {string} status - Stripe subscription status
 * @param {Date|number} currentPeriodEnd - End of current billing period
 * @returns {{ hasAccess: boolean, accessLevel: string, reason?: string }}
 */
export function resolveSubscriptionAccess(status, currentPeriodEnd) {
  const mapping = SUBSCRIPTION_STATUS_MAP[status];

  if (!mapping) {
    return {
      hasAccess: false,
      accessLevel: 'none',
      reason: 'unknown_status',
    };
  }

  // For grace period statuses, check if grace period has expired
  if (mapping.gracePeriodDays && currentPeriodEnd) {
    const periodEndDate =
      currentPeriodEnd instanceof Date ? currentPeriodEnd : new Date(currentPeriodEnd * 1000);

    const gracePeriodEnd = new Date(periodEndDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + mapping.gracePeriodDays);

    if (new Date() > gracePeriodEnd) {
      return {
        hasAccess: false,
        accessLevel: 'none',
        reason: 'grace_period_expired',
        gracePeriodExpiredAt: gracePeriodEnd,
      };
    }
  }

  return {
    hasAccess: mapping.hasAccess,
    accessLevel: mapping.accessLevel,
    description: mapping.description,
  };
}

/**
 * Check if a subscription status indicates active billing
 * @param {string} status - Stripe subscription status
 * @returns {boolean}
 */
export function isActiveSubscription(status) {
  return ['active', 'trialing', 'past_due'].includes(status);
}

/**
 * Check if a subscription status indicates it needs attention
 * @param {string} status - Stripe subscription status
 * @returns {boolean}
 */
export function needsAttention(status) {
  return ['past_due', 'unpaid', 'incomplete'].includes(status);
}

/**
 * Get user-friendly status message
 * @param {string} status - Stripe subscription status
 * @returns {string}
 */
export function getStatusMessage(status) {
  const messages = {
    active: 'Your subscription is active',
    trialing: 'Your trial is active',
    past_due: 'Payment failed - please update your payment method',
    unpaid: 'Invoice unpaid - action required',
    canceled: 'Your subscription has been canceled',
    incomplete: 'Please complete your payment to activate',
    incomplete_expired: 'Payment window expired',
    paused: 'Your subscription is paused',
  };

  return messages[status] || 'Unknown subscription status';
}
