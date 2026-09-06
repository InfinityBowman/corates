/**
 * Stripe setup metadata
 * Prices are addressed by Stripe lookup keys, never by price ids. A lookup key
 * is unique per account and mode, and `transfer_lookup_key` moves it to a new
 * price when the amount changes, so a price change needs no code or secret
 * change.
 */

import type { PlanId } from './types.js';
import { getPlanPricing } from './pricing.js';
import { getPlan } from './plans.js';

export type BillingInterval = 'monthly' | 'yearly';

export interface StripeProductConfig {
  planId: PlanId;
  name: string;
  description: string;
  prices: Array<{
    type: BillingInterval;
    amount: number;
    currency: string;
    lookupKey: string;
  }>;
}

/** Plans sold through Stripe. Free has no price; Enterprise is provisioned by hand. */
export const STRIPE_PLAN_IDS: PlanId[] = ['team', 'lab'];

/**
 * Product descriptions for Stripe products
 */
const PRODUCT_DESCRIPTIONS: Record<PlanId, string> = {
  free: 'Free tier (no subscription)',
  team: 'For small teams running a few reviews. Up to 3 projects, unlimited collaborators.',
  lab: 'For active labs and review groups. Up to 10 projects, unlimited collaborators.',
  enterprise: 'Quoted per customer (no self-serve price)',
};

export function getPriceLookupKey(planId: PlanId, interval: BillingInterval): string {
  return `${planId}_${interval}`;
}

/**
 * Inverse of getPriceLookupKey. Returns null for keys that do not belong to a
 * sold plan, so unknown prices are never mapped to a plan by accident.
 */
export function parsePriceLookupKey(
  lookupKey: string | null | undefined,
): { planId: PlanId; interval: BillingInterval } | null {
  if (!lookupKey) return null;
  for (const planId of STRIPE_PLAN_IDS) {
    for (const interval of ['monthly', 'yearly'] as const) {
      if (lookupKey === getPriceLookupKey(planId, interval)) return { planId, interval };
    }
  }
  return null;
}

/**
 * Get Stripe product configuration for a plan
 * Converts pricing from dollars to cents for Stripe API
 */
export function getStripeProductConfig(planId: PlanId): StripeProductConfig {
  const name = `CoRATES ${getPlan(planId).name}`;
  const description = PRODUCT_DESCRIPTIONS[planId];

  const pricing = getPlanPricing(planId);
  if (!pricing) {
    throw new Error(`No pricing found for plan: ${planId}`);
  }

  const prices: StripeProductConfig['prices'] = [];
  for (const interval of ['monthly', 'yearly'] as const) {
    const amount = pricing[interval];
    if (amount !== null && amount > 0) {
      prices.push({
        type: interval,
        amount: Math.round(amount * 100),
        currency: 'usd',
        lookupKey: getPriceLookupKey(planId, interval),
      });
    }
  }

  return { planId, name, description, prices };
}

/**
 * Get all Stripe product configurations for self-serve subscription plans
 * Returns products in the order they should be created
 */
export function getAllStripeProductConfigs(): StripeProductConfig[] {
  return STRIPE_PLAN_IDS.map(planId => getStripeProductConfig(planId));
}
