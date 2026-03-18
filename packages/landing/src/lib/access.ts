/**
 * Access control helper functions
 * Provides utilities for checking time-limited access status
 */

import { type Subscription } from '@/hooks/useSubscription';

export function hasActiveAccess(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  if (subscription.status !== 'active') return false;

  if (!subscription.currentPeriodEnd) return true;

  const now = Math.floor(Date.now() / 1000);
  return subscription.currentPeriodEnd > now;
}
