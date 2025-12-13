/**
 * Stripe configuration and price IDs
 */

// Subscription tiers and their Stripe price IDs
// Update these with your actual Stripe price IDs
export const PRICE_IDS = {
  pro: {
    monthly: 'price_pro_monthly', // TODO: Replace with actual Stripe price ID
    yearly: 'price_pro_yearly', // TODO: Replace with actual Stripe price ID
  },
  team: {
    monthly: 'price_team_monthly', // TODO: Replace with actual Stripe price ID
    yearly: 'price_team_yearly', // TODO: Replace with actual Stripe price ID
  },
  enterprise: {
    monthly: 'price_enterprise_monthly', // TODO: Replace with actual Stripe price ID
    yearly: 'price_enterprise_yearly', // TODO: Replace with actual Stripe price ID
  },
};

// Tier hierarchy for permission checks
export const TIER_LEVELS = {
  free: 0,
  pro: 1,
  team: 2,
  enterprise: 3,
};

// Feature access by tier
export const FEATURE_ACCESS = {
  'unlimited-projects': ['pro', 'team', 'enterprise'],
  'advanced-analytics': ['pro', 'team', 'enterprise'],
  'team-collaboration': ['team', 'enterprise'],
  'priority-support': ['team', 'enterprise'],
  sso: ['enterprise'],
  'custom-branding': ['enterprise'],
  'dedicated-support': ['enterprise'],
};

// Tier display names and descriptions
export const TIER_INFO = {
  free: {
    name: 'Free',
    description: 'For individuals getting started',
  },
  pro: {
    name: 'Pro',
    description: 'For researchers who need more',
  },
  team: {
    name: 'Team',
    description: 'For collaborative research teams',
  },
  enterprise: {
    name: 'Enterprise',
    description: 'For organizations with advanced needs',
  },
};

/**
 * Check if a tier has access to a minimum required tier
 * @param {string} userTier - The user's current tier
 * @param {string} requiredTier - The minimum required tier
 * @returns {boolean}
 */
export function hasMinimumTier(userTier, requiredTier) {
  const userLevel = TIER_LEVELS[userTier] ?? 0;
  const requiredLevel = TIER_LEVELS[requiredTier] ?? 0;
  return userLevel >= requiredLevel;
}

/**
 * Check if a tier has access to a specific feature
 * @param {string} userTier - The user's current tier
 * @param {string} feature - The feature to check
 * @returns {boolean}
 */
export function hasFeatureAccess(userTier, feature) {
  const allowedTiers = FEATURE_ACCESS[feature];
  if (!allowedTiers) return true; // Feature not gated
  return allowedTiers.includes(userTier);
}

/**
 * Get the price ID for a tier and billing interval
 * @param {string} tier - The subscription tier
 * @param {'monthly' | 'yearly'} interval - The billing interval
 * @returns {string | null}
 */
export function getPriceId(tier, interval = 'monthly') {
  return PRICE_IDS[tier]?.[interval] ?? null;
}
