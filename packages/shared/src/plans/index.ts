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

// Plan configuration
export { PLANS, DEFAULT_PLAN, getPlan } from './plans.js';
