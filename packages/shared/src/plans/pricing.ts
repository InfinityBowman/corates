/**
 * Plan pricing configuration
 * Centralized pricing data for all plans
 */

import type { PlanId } from './types.js';

export interface PlanPricing {
  monthly: number | null;
  yearly: number | null;
}

/**
 * Pricing configuration for all plans
 * Prices are in USD. Annual is the base price and is chosen so it divides to a
 * whole number of dollars per month; monthly is 12 months for the cost of 10,
 * which the UI shows as the percentage saved.
 * yearly prices are annual total (not per month)
 * Enterprise is quoted per customer and has no self-serve price.
 */
export const PLAN_PRICING: Record<PlanId, PlanPricing> = {
  free: {
    monthly: 0,
    yearly: 0,
  },
  team: {
    monthly: 30,
    yearly: 300,
  },
  lab: {
    monthly: 90,
    yearly: 900,
  },
  enterprise: {
    monthly: null,
    yearly: null,
  },
};

/**
 * Get pricing for a plan
 * @param planId - Plan ID
 * @returns Plan pricing or null if plan doesn't exist
 */
export function getPlanPricing(planId: PlanId | string): PlanPricing | null {
  if (planId in PLAN_PRICING) {
    return PLAN_PRICING[planId as PlanId];
  }
  return null;
}

/**
 * Calculate monthly equivalent from annual price
 * @param yearlyPrice - Annual price
 * @returns Monthly equivalent (yearly / 12)
 */
export function getMonthlyEquivalent(yearlyPrice: number): number {
  return yearlyPrice / 12;
}
