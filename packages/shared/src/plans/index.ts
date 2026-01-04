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

// Plan configuration
export { PLANS, DEFAULT_PLAN, getPlan, isUnlimitedQuota, getGrantPlan } from './plans.js';
