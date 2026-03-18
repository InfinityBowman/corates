/**
 * Plan Redirect Utilities
 * Shared logic for capturing plan params from landing page URLs
 * and redirecting users to appropriate checkout flows after authentication.
 */

import { CHECKOUT_ELIGIBLE_TIERS } from '@corates/shared/plans';
import { startTrial, redirectToCheckout, redirectToSingleProjectCheckout } from '@/api/billing';
import { showToast } from '@/components/ui/toast';

type BillingInterval = 'monthly' | 'yearly';

interface PlanRedirectError {
  code?: string;
  details?: {
    field?: string;
    value?: string;
    reason?: string;
  };
  message?: string;
}

interface NavigateOptions {
  to: string;
  replace?: boolean;
}

interface HandlePendingPlanRedirectOptions {
  navigate?: (_opts: NavigateOptions) => void;
  refetch?: () => Promise<unknown>;
}

interface PlanRedirectResult {
  handled: boolean;
  error: PlanRedirectError | null;
}

export const DEFAULT_INTERVAL: BillingInterval = 'monthly';

export const STORAGE_KEYS = {
  PENDING_PLAN: 'pendingPlan',
  PENDING_INTERVAL: 'pendingInterval',
} as const;

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
} as const;

export function validateInterval(interval: string | null): BillingInterval {
  return interval === 'yearly' ? 'yearly' : DEFAULT_INTERVAL;
}

/**
 * Capture plan/interval params from URL and store in localStorage.
 * Call this when user lands on signup page with plan params from landing pricing.
 */
export function capturePlanParams(urlParams: URLSearchParams): boolean {
  const planParam = urlParams.get('plan');
  const intervalParam = urlParams.get('interval');

  if (planParam && (CHECKOUT_ELIGIBLE_TIERS as readonly string[]).includes(planParam)) {
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

export function getPendingPlan(): { plan: string | null; interval: BillingInterval } {
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

export function hasPendingPlan(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEYS.PENDING_PLAN);
  } catch {
    return false;
  }
}

export function clearPendingPlan(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.PENDING_PLAN);
    localStorage.removeItem(STORAGE_KEYS.PENDING_INTERVAL);
  } catch (err) {
    console.error('Failed to clear pending plan from localStorage:', err);
  }
}

function isTrialAlreadyUsedError(err: unknown): boolean {
  const e = err as PlanRedirectError | undefined;
  return (
    !!e?.code?.startsWith?.('VALIDATION_') &&
    e?.details?.field === 'trial' &&
    e?.details?.value === 'already_exists'
  );
}

function isAlreadyOnPlanError(err: unknown): boolean {
  const e = err as PlanRedirectError | undefined;
  return !!e?.code?.startsWith?.('VALIDATION_') && e?.details?.reason === 'already_on_plan';
}

function isPlanChangeBlockedError(err: unknown): boolean {
  const e = err as PlanRedirectError | undefined;
  return (
    !!e?.code?.startsWith?.('VALIDATION_') && e?.details?.reason === 'downgrade_exceeds_quotas'
  );
}

/**
 * Handle pending plan redirect from localStorage.
 * Processes plan param and redirects to appropriate checkout or starts trial.
 */
export async function handlePendingPlanRedirect(
  options: HandlePendingPlanRedirectOptions = {},
): Promise<PlanRedirectResult> {
  const { navigate, refetch } = options;
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
      if (navigate) navigate({ to: '/dashboard', replace: true });
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

    if (isTrialAlreadyUsedError(err)) {
      clearPendingPlan();
      showToast.info(
        BILLING_MESSAGES.TRIAL_ALREADY_USED.title,
        BILLING_MESSAGES.TRIAL_ALREADY_USED.message,
      );
      if (navigate) navigate({ to: '/settings/plans', replace: true });
      return { handled: true, error: null };
    }

    if (isAlreadyOnPlanError(err)) {
      clearPendingPlan();
      showToast.info(
        BILLING_MESSAGES.ALREADY_ON_PLAN.title,
        BILLING_MESSAGES.ALREADY_ON_PLAN.message,
      );
      if (navigate) navigate({ to: '/settings/billing', replace: true });
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

    return { handled: true, error: err as PlanRedirectError };
  }
}
