/**
 * Stripe setup metadata
 * Provides product information and environment variable mappings for Stripe setup scripts
 */

import type { PlanId } from './types.js';
import { getPlanPricing } from './pricing.js';
import { getPlan } from './plans.js';

export interface StripeProductConfig {
  planId: PlanId;
  name: string;
  description: string;
  prices: Array<{
    type: 'monthly' | 'yearly';
    amount: number;
    currency: string;
  }>;
  envKeys: {
    monthly?: string;
    yearly?: string;
  };
}

/**
 * Product descriptions for Stripe products
 */
const PRODUCT_DESCRIPTIONS: Record<PlanId, string> = {
  free: 'Free tier (no subscription)',
  team: 'For small teams running a few reviews',
  lab: 'For active labs and review groups',
  enterprise: 'Quoted per customer (no self-serve price)',
};

/**
 * Environment variable key mappings for Stripe price IDs
 */
const ENV_KEY_MAPPINGS: Record<PlanId, StripeProductConfig['envKeys']> = {
  free: {},
  team: {
    monthly: 'STRIPE_PRICE_ID_TEAM_MONTHLY',
    yearly: 'STRIPE_PRICE_ID_TEAM_YEARLY',
  },
  lab: {
    monthly: 'STRIPE_PRICE_ID_LAB_MONTHLY',
    yearly: 'STRIPE_PRICE_ID_LAB_YEARLY',
  },
  enterprise: {},
};

/**
 * Get Stripe product configuration for a plan
 * Converts pricing from dollars to cents for Stripe API
 */
export function getStripeProductConfig(planId: PlanId): StripeProductConfig {
  const name = getPlan(planId).name;
  const description = PRODUCT_DESCRIPTIONS[planId];
  const envKeys = ENV_KEY_MAPPINGS[planId];

  const pricing = getPlanPricing(planId);
  if (!pricing) {
    throw new Error(`No pricing found for plan: ${planId}`);
  }

  const prices: StripeProductConfig['prices'] = [];

  if (pricing.monthly !== null && pricing.monthly > 0) {
    prices.push({
      type: 'monthly',
      amount: Math.round(pricing.monthly * 100),
      currency: 'usd',
    });
  }

  if (pricing.yearly !== null && pricing.yearly > 0) {
    prices.push({
      type: 'yearly',
      amount: Math.round(pricing.yearly * 100),
      currency: 'usd',
    });
  }

  return {
    planId,
    name,
    description,
    prices,
    envKeys,
  };
}

/**
 * Get all Stripe product configurations for self-serve subscription plans
 * Returns products in the order they should be created
 */
export function getAllStripeProductConfigs(): StripeProductConfig[] {
  const subscriptionPlans: PlanId[] = ['team', 'lab'];
  return subscriptionPlans.map(planId => getStripeProductConfig(planId));
}
