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
 * Prices are in USD per month
 * yearly prices are annual total (not per month)
 */
export const PLAN_PRICING: Record<PlanId, PlanPricing> = {
  free: {
    monthly: 0,
    yearly: 0,
  },
  starter_team: {
    monthly: 9.99,
    yearly: 100, // 9.99 * 10 months (2 months free, rounded)
  },
  team: {
    monthly: 29,
    yearly: 290, // 29 * 10 months (2 months free)
  },
  unlimited_team: {
    monthly: 49,
    yearly: 490, // 49 * 10 months (2 months free)
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
  return Math.round(yearlyPrice / 12);
}
