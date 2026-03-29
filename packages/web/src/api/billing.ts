/**
 * Billing API functions
 * Handles all billing-related API calls
 */

import { parseResponse } from 'hono/client';
import { api } from '@/lib/rpc';

type BillingInterval = 'monthly' | 'yearly';

async function createCheckoutSession(tier: string, interval: BillingInterval = 'monthly') {
  return parseResponse(api.api.billing.checkout.$post({ json: { tier, interval } }));
}

async function createPortalSession() {
  return parseResponse(api.api.billing.portal.$post({}));
}

export async function redirectToCheckout(
  tier: string,
  interval: BillingInterval = 'monthly',
): Promise<void> {
  const { url } = await createCheckoutSession(tier, interval);
  window.location.href = url;
}

export async function redirectToPortal(): Promise<void> {
  const { url } = await createPortalSession();
  window.location.href = url;
}

async function createSingleProjectCheckout() {
  return parseResponse(api.api.billing['single-project'].checkout.$post({ json: {} }));
}

export async function redirectToSingleProjectCheckout(): Promise<void> {
  const { url } = await createSingleProjectCheckout();
  window.location.href = url;
}

export async function getMembers() {
  return parseResponse(api.api.billing.members.$get());
}

export async function startTrial() {
  return parseResponse(api.api.billing.trial.start.$post({ json: {} }));
}

export async function validatePlanChange(targetPlan: string) {
  return parseResponse(
    api.api.billing['validate-plan-change'].$get({
      query: { targetPlan },
    }),
  );
}
