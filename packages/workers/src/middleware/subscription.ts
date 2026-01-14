import type { Context } from 'hono';
import { DEFAULT_SUBSCRIPTION_TIER } from '../config/constants';

export function getSubscription(c: Context): {
  subscription: unknown;
  tier: string;
} {
  return {
    subscription: c.get('subscription') ?? null,
    tier: (c.get('tier') as string | undefined) ?? DEFAULT_SUBSCRIPTION_TIER,
  };
}
