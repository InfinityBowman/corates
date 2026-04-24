import {
  checkoutSubscription,
  openBillingPortal,
  checkoutSingleProject,
  startTrialGrant,
} from '@/server/functions/billing.functions';

type BillingInterval = 'monthly' | 'yearly';

export async function redirectToCheckout(
  tier: string,
  interval: BillingInterval = 'monthly',
): Promise<void> {
  const result = await checkoutSubscription({ data: { tier, interval } });
  window.location.href = (result as { url: string }).url;
}

export async function redirectToPortal(): Promise<void> {
  const result = await openBillingPortal();
  window.location.href = (result as { url: string }).url;
}

export async function redirectToSingleProjectCheckout(): Promise<void> {
  const result = await checkoutSingleProject();
  window.location.href = (result as { url: string }).url;
}

export async function startTrial() {
  return startTrialGrant();
}
