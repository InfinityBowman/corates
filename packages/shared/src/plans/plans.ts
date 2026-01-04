/**
 * Plan configuration
 * Maps plans to entitlements (boolean capabilities) and quotas (numeric limits)
 * Plans are static configuration - not stored in database
 */

import type { Plans, PlanId, Plan } from './types.js';

/**
 * Plan configurations for all subscription tiers
 */
export const PLANS: Plans = {
  free: {
    name: 'Free',
    entitlements: {
      'project.create': false,
    },
    quotas: {
      'projects.max': 0,
      'collaborators.org.max': 0,
    },
  },
  starter_team: {
    name: 'Starter Team',
    entitlements: {
      'project.create': true,
    },
    quotas: {
      'projects.max': 3,
      'collaborators.org.max': 5,
    },
  },
  team: {
    name: 'Team',
    entitlements: {
      'project.create': true,
    },
    quotas: {
      'projects.max': 10,
      'collaborators.org.max': 15,
    },
  },
  unlimited_team: {
    name: 'Unlimited Team',
    entitlements: {
      'project.create': true,
    },
    quotas: {
      'projects.max': -1,
      'collaborators.org.max': -1,
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

/**
 * Grant types - not plans, but provide access similar to plans
 */
export type GrantType = 'trial' | 'single_project';

/**
 * Get plan-like configuration for a grant type
 * Grants provide temporary access and map to specific quotas/entitlements
 */
export function getGrantPlan(grantType: GrantType): Plan {
  switch (grantType) {
    case 'trial':
      return {
        name: 'Trial',
        entitlements: {
          'project.create': true,
        },
        quotas: {
          'projects.max': 1,
          'collaborators.org.max': 3,
        },
      };
    case 'single_project':
      return {
        name: 'Single Project',
        entitlements: {
          'project.create': true,
        },
        quotas: {
          'projects.max': 1,
          'collaborators.org.max': 3,
        },
      };
    default:
      return PLANS[DEFAULT_PLAN];
  }
}
