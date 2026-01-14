interface Subscription {
  status: string;
  currentPeriodEnd?: number | null;
}

export function hasActiveAccess(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  if (subscription.status !== 'active') return false;

  if (!subscription.currentPeriodEnd) return true;

  const now = Math.floor(Date.now() / 1000);
  return subscription.currentPeriodEnd > now;
}

export function isAccessExpired(subscription: Subscription | null): boolean {
  if (!subscription) return true;
  if (subscription.status !== 'active') return true;

  if (!subscription.currentPeriodEnd) return false;

  const now = Math.floor(Date.now() / 1000);
  return subscription.currentPeriodEnd <= now;
}
