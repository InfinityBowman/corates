/**
 * Plan configuration
 * Maps plans to entitlements (boolean capabilities) and quotas (numeric limits)
 * Plans are static configuration - not stored in database
 */

export const PLANS = {
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
      'projects.max': Infinity,
      'storage.project.maxMB': Infinity,
      'ai.tokens.monthly': Infinity,
    },
  },
};

export const DEFAULT_PLAN = 'free';

/**
 * Get plan configuration by plan ID
 * @param {string} planId - Plan ID (e.g., 'free', 'pro', 'unlimited')
 * @returns {Object} Plan configuration
 */
export function getPlan(planId) {
  return PLANS[planId] || PLANS[DEFAULT_PLAN];
}
