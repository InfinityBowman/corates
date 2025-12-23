/**
 * Type definitions for plan configuration
 * Defines types for plan IDs, entitlement keys, quota keys, and plan structure
 */

/**
 * Plan ID - identifies a subscription tier
 */
export type PlanId = 'free' | 'pro' | 'unlimited';

/**
 * Entitlement keys - boolean capabilities that can be enabled/disabled per plan
 */
export type EntitlementKey =
  | 'project.create'
  | 'checklist.edit'
  | 'export.pdf'
  | 'ai.run';

/**
 * Quota keys - numeric limits that can be set per plan
 */
export type QuotaKey =
  | 'projects.max'
  | 'storage.project.maxMB'
  | 'ai.tokens.monthly';

/**
 * Entitlements - mapping of entitlement keys to boolean values
 */
export interface Entitlements {
  'project.create': boolean;
  'checklist.edit': boolean;
  'export.pdf': boolean;
  'ai.run': boolean;
}

/**
 * Quotas - mapping of quota keys to numeric values (Infinity for unlimited)
 */
export interface Quotas {
  'projects.max': number;
  'storage.project.maxMB': number;
  'ai.tokens.monthly': number;
}

/**
 * Plan configuration - defines entitlements and quotas for a subscription tier
 */
export interface Plan {
  name: string;
  entitlements: Entitlements;
  quotas: Quotas;
}

/**
 * Plans - record of all plan configurations indexed by plan ID
 */
export type Plans = Record<PlanId, Plan>;
