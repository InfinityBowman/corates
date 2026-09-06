import { checkoutSubscription, openBillingPortal } from '@/server/functions/billing.functions';

type BillingInterval = 'monthly' | 'yearly';

export async function redirectToCheckout(
  tier: string,
  interval: BillingInterval = 'yearly',
): Promise<void> {
  const result = await checkoutSubscription({ data: { tier, interval } });
  window.location.href = (result as { url: string }).url;
}

export async function redirectToPortal(): Promise<void> {
  const result = await openBillingPortal();
  window.location.href = (result as { url: string }).url;
}
