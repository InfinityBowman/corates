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
 * Get the price ID for a tier and billing interval
 * @param {string} tier - The subscription tier
 * @param {'monthly' | 'yearly'} interval - The billing interval
 * @returns {string | null}
 */
export function getPriceId(tier, interval = 'monthly') {
  return PRICE_IDS[tier]?.[interval] ?? null;
}
