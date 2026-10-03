import { checkoutSubscription, openBillingPortal } from '@/server/functions/billing.functions';

type BillingInterval = 'monthly' | 'yearly';

export async function redirectToCheckout(
  orgId: string,
  tier: string,
  interval: BillingInterval = 'yearly',
): Promise<void> {
  const result = await checkoutSubscription({ data: { orgId, tier, interval } });
  window.location.href = (result as { url: string }).url;
}

export async function redirectToPortal(orgId: string): Promise<void> {
  const result = await openBillingPortal({ data: { orgId } });
  window.location.href = (result as { url: string }).url;
}
