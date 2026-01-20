/**
 * Public API exports for plans module
 * This is the main entry point for consuming plan configuration
 */

// Types
export type {
  PlanId,
  EntitlementKey,
  QuotaKey,
  Entitlements,
  Quotas,
  Plan,
  Plans,
} from './types.js';
export type { GrantType } from './plans.js';
export type {
  BillingCatalogTier,
  BillingCatalogCTA,
  BillingCatalogPlan,
  BillingCatalogResponse,
} from './catalog.js';

// Plan configuration
export { PLANS, DEFAULT_PLAN, getPlan, isUnlimitedQuota, getGrantPlan } from './plans.js';

// Pricing
export { PLAN_PRICING, getPlanPricing, getMonthlyEquivalent } from './pricing.js';
export type { PlanPricing } from './pricing.js';

// Billing catalog (pricing page / billing UI)
export { getBillingPlanCatalog, CHECKOUT_ELIGIBLE_TIERS } from './catalog.js';

// Stripe setup
export { getStripeProductConfig, getAllStripeProductConfigs } from './stripe.js';
export type { StripeProductConfig } from './stripe.js';
