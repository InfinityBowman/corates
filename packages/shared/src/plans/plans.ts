/**
 * Plan configuration
 * Maps plans to entitlements (boolean capabilities) and quotas (numeric limits)
 * Plans are static configuration - not stored in database
 */

import type { Plans, PlanId } from './types.js';

/**
 * Plan configurations for all subscription tiers
 */
export const PLANS: Plans = {
  free: {
    name: 'Free',
    entitlements: {
      'project.create': false,
      'checklist.edit': true,
      'export.pdf': false,
      'ai.run': false,
    },
    quotas: {
      'projects.max': 0,
      'storage.project.maxMB': 10,
      'ai.tokens.monthly': 0,
    },
  },
  pro: {
    name: 'Pro',
    entitlements: {
      'project.create': true,
      'checklist.edit': true,
      'export.pdf': true,
      'ai.run': true,
    },
    quotas: {
      'projects.max': 10,
      'storage.project.maxMB': 1000,
      'ai.tokens.monthly': 100000,
    },
  },
  unlimited: {
    name: 'Unlimited',
    entitlements: {
      'project.create': true,
      'checklist.edit': true,
      'export.pdf': true,
      'ai.run': true,
    },
    quotas: {
      'projects.max': -1,
      'storage.project.maxMB': -1,
      'ai.tokens.monthly': -1,
    },
  },
};

/**
 * Default plan ID for users without an active subscription
 */
export const DEFAULT_PLAN: PlanId = 'free';

/**
 * Get plan configuration by plan ID
 * @param planId - Plan ID (e.g., 'free', 'pro', 'unlimited')
 * @returns Plan configuration, or default plan if planId is invalid
 */
export function getPlan(planId: PlanId | string): Plans[PlanId] {
  if (planId in PLANS) {
    return PLANS[planId as PlanId];
  }
  return PLANS[DEFAULT_PLAN];
}

/**
 * Check if a quota value represents unlimited quota
 * @param quota - Quota value to check
 * @returns True if quota is unlimited (value is -1)
 */
export function isUnlimitedQuota(quota: number): boolean {
  return quota === -1;
}
