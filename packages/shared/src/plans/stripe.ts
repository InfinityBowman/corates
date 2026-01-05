/**
 * Stripe setup metadata
 * Provides product information and environment variable mappings for Stripe setup scripts
 */

import type { PlanId } from './types.js';
import { getPlanPricing } from './pricing.js';
import { getPlan } from './plans.js';
import { getBillingPlanCatalog } from './catalog.js';

export interface StripeProductConfig {
  planId: PlanId | 'single_project';
  name: string;
  description: string;
  prices: Array<{
    type: 'monthly' | 'yearly' | 'one-time';
    amount: number;
    currency: string;
  }>;
  envKeys: {
    monthly?: string;
    yearly?: string;
    'one-time'?: string;
  };
}

/**
 * Product descriptions for Stripe products
 */
const PRODUCT_DESCRIPTIONS: Record<PlanId | 'single_project', string> = {
  free: 'Free tier (no subscription)',
  starter_team: 'For small teams',
  team: 'For collaborative research teams',
  unlimited_team: 'For large organizations',
  single_project: 'One-time purchase for a single project',
};

/**
 * Environment variable key mappings for Stripe price IDs
 */
const ENV_KEY_MAPPINGS: Record<PlanId | 'single_project', StripeProductConfig['envKeys']> = {
  free: {},
  starter_team: {
    monthly: 'STRIPE_PRICE_ID_STARTER_TEAM_MONTHLY',
    yearly: 'STRIPE_PRICE_ID_STARTER_TEAM_YEARLY',
  },
  team: {
    monthly: 'STRIPE_PRICE_ID_TEAM_MONTHLY',
    yearly: 'STRIPE_PRICE_ID_TEAM_YEARLY',
  },
  unlimited_team: {
    monthly: 'STRIPE_PRICE_ID_UNLIMITED_TEAM_MONTHLY',
    yearly: 'STRIPE_PRICE_ID_UNLIMITED_TEAM_YEARLY',
  },
  single_project: {
    'one-time': 'STRIPE_PRICE_ID_SINGLE_PROJECT',
  },
};

/**
 * Get Stripe product configuration for a plan
 * Converts pricing from dollars to cents for Stripe API
 */
export function getStripeProductConfig(planId: PlanId | 'single_project'): StripeProductConfig {
  const name = planId === 'single_project' ? 'Single Project' : getPlan(planId).name;
  const description = PRODUCT_DESCRIPTIONS[planId];
  const envKeys = ENV_KEY_MAPPINGS[planId];

  if (planId === 'single_project') {
    const catalog = getBillingPlanCatalog();
    const singleProjectPlan = catalog.plans.find(p => p.tier === 'single_project');
    const oneTimeAmount = singleProjectPlan?.oneTime?.amount || 39;

    return {
      planId: 'single_project',
      name,
      description,
      prices: [
        {
          type: 'one-time',
          amount: Math.round(oneTimeAmount * 100),
          currency: 'usd',
        },
      ],
      envKeys,
    };
  }

  const pricing = getPlanPricing(planId);
  if (!pricing) {
    throw new Error(`No pricing found for plan: ${planId}`);
  }

  const prices: Array<{
    type: 'monthly' | 'yearly' | 'one-time';
    amount: number;
    currency: string;
  }> = [];

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
 * Get all Stripe product configurations for subscription plans and single project
 * Returns products in the order they should be created
 */
export function getAllStripeProductConfigs(): StripeProductConfig[] {
  const subscriptionPlans: PlanId[] = ['starter_team', 'team', 'unlimited_team'];
  const configs = subscriptionPlans.map(planId => getStripeProductConfig(planId));
  configs.push(getStripeProductConfig('single_project'));
  return configs;
}
