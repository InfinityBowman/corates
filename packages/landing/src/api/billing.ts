/**
 * Billing API functions
 * Handles all billing-related API calls
 */

import { parseResponse } from 'hono/client';
import { apiFetch } from '@/lib/apiFetch';
import { api } from '@/lib/rpc';

interface CheckoutSession {
  url: string;
  sessionId: string;
}

interface PortalSession {
  url: string;
}

interface TrialResult {
  success: boolean;
  grantId: string;
  expiresAt: number;
}

type BillingInterval = 'monthly' | 'yearly';

interface BillingOptions {
  showToast?: boolean;
  toastMessage?: string | false;
}

async function createCheckoutSession(
  tier: string,
  interval: BillingInterval = 'monthly',
  options: BillingOptions = {},
): Promise<CheckoutSession> {
  return apiFetch.post<CheckoutSession>('/api/billing/checkout', { tier, interval }, options);
}

export async function createPortalSession(): Promise<PortalSession> {
  return apiFetch.post<PortalSession>('/api/billing/portal');
}

export async function redirectToCheckout(
  tier: string,
  interval: BillingInterval = 'monthly',
  options: BillingOptions = {},
): Promise<void> {
  const { url } = await createCheckoutSession(tier, interval, { showToast: false, ...options });
  window.location.href = url;
}

export async function redirectToPortal(): Promise<void> {
  const { url } = await createPortalSession();
  window.location.href = url;
}

async function createSingleProjectCheckout(options: BillingOptions = {}): Promise<CheckoutSession> {
  return apiFetch.post<CheckoutSession>('/api/billing/single-project/checkout', {}, options);
}

export async function redirectToSingleProjectCheckout(options: BillingOptions = {}): Promise<void> {
  const { url } = await createSingleProjectCheckout({ showToast: false, ...options });
  window.location.href = url;
}

export async function getMembers() {
  return parseResponse(api.api.billing.members.$get());
}

export async function startTrial(options: BillingOptions = {}): Promise<TrialResult> {
  return apiFetch.post<TrialResult>(
    '/api/billing/trial/start',
    {},
    { showToast: false, ...options },
  );
}

export async function validatePlanChange(targetPlan: string) {
  return parseResponse(
    api.api.billing['validate-plan-change'].$get({
      query: { targetPlan },
    }),
  );
}
