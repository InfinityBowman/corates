/**
 * Type definitions for plan configuration
 * Defines types for plan IDs, entitlement keys, quota keys, and plan structure
 */

/**
 * Plan ID - identifies a subscription tier
 */
export type PlanId = 'free' | 'starter_team' | 'team' | 'unlimited_team';

/**
 * Entitlement keys - boolean capabilities that can be enabled/disabled per plan
 */
export type EntitlementKey = 'project.create';

/**
 * Quota keys - numeric limits that can be set per plan
 */
export type QuotaKey = 'projects.max' | 'collaborators.org.max';

/**
 * Entitlements - mapping of entitlement keys to boolean values
 */
export interface Entitlements {
  'project.create': boolean;
}

/**
 * Quotas - mapping of quota keys to numeric values
 * A value of -1 indicates unlimited quota (JSON-safe alternative to Infinity)
 */
export interface Quotas {
  'projects.max': number;
  'collaborators.org.max': number;
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
