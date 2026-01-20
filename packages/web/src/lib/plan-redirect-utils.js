/**
 * Plan Redirect Utilities
 * Shared logic for capturing plan params from landing page URLs
 * and redirecting users to appropriate checkout flows after authentication.
 */

import { CHECKOUT_ELIGIBLE_TIERS } from '@corates/shared/plans';
import { startTrial, redirectToCheckout, redirectToSingleProjectCheckout } from '@/api/billing.js';
import { showToast } from '@/components/ui/toast';

/**
 * Valid billing intervals
 */
export const VALID_INTERVALS = ['monthly', 'yearly'];
export const DEFAULT_INTERVAL = 'monthly';

/**
 * Centralized localStorage keys for plan redirect state
 */
export const STORAGE_KEYS = {
  PENDING_PLAN: 'pendingPlan',
  PENDING_INTERVAL: 'pendingInterval',
};

/**
 * Billing-related toast messages
 */
export const BILLING_MESSAGES = {
  TRIAL_STARTED: {
    title: 'Trial Started',
    message: 'Your 14-day trial is now active.',
  },
  TRIAL_ALREADY_USED: {
    title: 'Trial Already Used',
    message: 'You have already used your free trial. Please select a paid plan.',
  },
  ALREADY_ON_PLAN: {
    title: 'Already on This Plan',
    message: 'You are already subscribed to this plan.',
  },
  PLAN_DOWNGRADE_BLOCKED: {
    title: 'Plan Change Blocked',
    message: "Your current usage exceeds this plan's limits. Please reduce usage first.",
  },
  CHECKOUT_ERROR: {
    title: 'Checkout Error',
    message: 'Unable to redirect to checkout. Please try again.',
  },
};

/**
 * Validate and normalize billing interval
 * @param {string | null} interval - Raw interval value
 * @returns {'monthly' | 'yearly'}
 */
export function validateInterval(interval) {
  return interval === 'yearly' ? 'yearly' : DEFAULT_INTERVAL;
}

/**
 * Capture plan/interval params from URL and store in localStorage
 * Call this when user lands on signup page with plan params from landing pricing
 * @param {URLSearchParams} urlParams - URL search params
 * @returns {boolean} - True if valid plan was captured
 */
export function capturePlanParams(urlParams) {
  const planParam = urlParams.get('plan');
  const intervalParam = urlParams.get('interval');

  if (planParam && CHECKOUT_ELIGIBLE_TIERS.includes(planParam)) {
    try {
      localStorage.setItem(STORAGE_KEYS.PENDING_PLAN, planParam);
      localStorage.setItem(STORAGE_KEYS.PENDING_INTERVAL, validateInterval(intervalParam));
      return true;
    } catch (err) {
      console.error('Failed to save plan params to localStorage:', err);
      return false;
    }
  }
  return false;
}

/**
 * Get pending plan data from localStorage
 * @returns {{ plan: string | null, interval: 'monthly' | 'yearly' }}
 */
export function getPendingPlan() {
  try {
    const plan = localStorage.getItem(STORAGE_KEYS.PENDING_PLAN);
    const rawInterval = localStorage.getItem(STORAGE_KEYS.PENDING_INTERVAL);
    return {
      plan,
      interval: validateInterval(rawInterval),
    };
  } catch (err) {
    console.error('Failed to read pending plan from localStorage:', err);
    return { plan: null, interval: DEFAULT_INTERVAL };
  }
}

/**
 * Check if there's a pending plan in localStorage
 * @returns {boolean}
 */
export function hasPendingPlan() {
  try {
    return !!localStorage.getItem(STORAGE_KEYS.PENDING_PLAN);
  } catch (_err) {
    return false;
  }
}

/**
 * Clear pending plan data from localStorage
 */
export function clearPendingPlan() {
  try {
    localStorage.removeItem(STORAGE_KEYS.PENDING_PLAN);
    localStorage.removeItem(STORAGE_KEYS.PENDING_INTERVAL);
  } catch (err) {
    console.error('Failed to clear pending plan from localStorage:', err);
  }
}

/**
 * Check if error indicates trial was already used
 * @param {Error} err - Error object from API
 * @returns {boolean}
 */
function isTrialAlreadyUsedError(err) {
  return (
    err?.code?.startsWith?.('VALIDATION_') &&
    err?.details?.field === 'trial' &&
    err?.details?.value === 'already_exists'
  );
}

/**
 * Check if error indicates user is already on this plan
 * @param {Error} err - Error object from API
 * @returns {boolean}
 */
function isAlreadyOnPlanError(err) {
  return err?.code?.startsWith?.('VALIDATION_') && err?.details?.reason === 'already_on_plan';
}

/**
 * Check if error indicates plan change blocked due to quota violations
 * @param {Error} err - Error object from API
 * @returns {boolean}
 */
function isPlanChangeBlockedError(err) {
  return (
    err?.code?.startsWith?.('VALIDATION_') && err?.details?.reason === 'downgrade_exceeds_quotas'
  );
}

/**
 * Handle pending plan redirect from localStorage
 * Processes plan param and redirects to appropriate checkout or starts trial.
 *
 * @param {Object} options
 * @param {Function} options.navigate - SolidJS navigate function
 * @param {Function} [options.refetch] - Optional subscription refetch function (for trial)
 * @returns {Promise<{ handled: boolean, error: Error | null }>}
 *   - handled: true if there was a pending plan (success or error)
 *   - error: Error object if redirect failed, null otherwise
 */
export async function handlePendingPlanRedirect({ navigate, refetch } = {}) {
  const { plan: pendingPlan, interval: pendingInterval } = getPendingPlan();

  if (!pendingPlan) {
    return { handled: false, error: null };
  }

  try {
    if (pendingPlan === 'trial') {
      await startTrial();
      clearPendingPlan();
      showToast.success(
        BILLING_MESSAGES.TRIAL_STARTED.title,
        BILLING_MESSAGES.TRIAL_STARTED.message,
      );
      if (refetch) await refetch();
      if (navigate) navigate('/dashboard', { replace: true });
      return { handled: true, error: null };
    }

    if (pendingPlan === 'single_project') {
      await redirectToSingleProjectCheckout();
      clearPendingPlan();
      return { handled: true, error: null };
    }

    // Subscription plans (starter_team, team, unlimited_team)
    await redirectToCheckout(pendingPlan, pendingInterval);
    clearPendingPlan();
    return { handled: true, error: null };
  } catch (err) {
    console.error('Plan redirect error:', err);

    // Handle specific error cases with appropriate messaging
    if (isTrialAlreadyUsedError(err)) {
      clearPendingPlan();
      showToast.info(
        BILLING_MESSAGES.TRIAL_ALREADY_USED.title,
        BILLING_MESSAGES.TRIAL_ALREADY_USED.message,
      );
      // Redirect to plans page so they can choose a paid plan
      if (navigate) navigate('/settings/plans', { replace: true });
      return { handled: true, error: null };
    }

    if (isAlreadyOnPlanError(err)) {
      clearPendingPlan();
      showToast.info(
        BILLING_MESSAGES.ALREADY_ON_PLAN.title,
        BILLING_MESSAGES.ALREADY_ON_PLAN.message,
      );
      // Redirect to billing settings since they're already subscribed
      if (navigate) navigate('/settings/billing', { replace: true });
      return { handled: true, error: null };
    }

    if (isPlanChangeBlockedError(err)) {
      clearPendingPlan();
      showToast.error(
        BILLING_MESSAGES.PLAN_DOWNGRADE_BLOCKED.title,
        BILLING_MESSAGES.PLAN_DOWNGRADE_BLOCKED.message,
      );
      // Stay on plans page to show what's blocking
      return { handled: true, error: null };
    }

    // For other trial errors, clear and let caller handle
    // Trial activation is a direct API call - if it fails for other reasons,
    // retrying likely won't help (e.g., server error, auth issue)
    if (pendingPlan === 'trial') {
      clearPendingPlan();
    }
    // For checkout redirects, keep pending plan for retry
    // These can fail transiently (network issues, Stripe API timeouts)

    return { handled: true, error: err };
  }
}
