/**
 * Centralized constants for the workers package
 * All shared constants should be defined here to avoid duplication
 */

/**
 * Valid project member roles
 * Simplified to owner (full access) and member (can edit)
 */
export const PROJECT_ROLES = ['owner', 'member'];

/**
 * Roles that can edit project content
 */
export const EDIT_ROLES = ['owner', 'member'];

/**
 * Roles that can manage project members
 */
export const ADMIN_ROLES = ['owner'];

/**
 * Valid subscription tiers
 */
export const SUBSCRIPTION_TIERS = ['free', 'basic', 'pro', 'team', 'enterprise'];

/**
 * Valid subscription statuses
 */
export const SUBSCRIPTION_STATUSES = ['active', 'canceled', 'past_due', 'trialing', 'incomplete'];

/**
 * Default subscription tier for new users
 */
export const DEFAULT_SUBSCRIPTION_TIER = 'free';

/**
 * Default subscription status for new subscriptions
 */
export const DEFAULT_SUBSCRIPTION_STATUS = 'active';

/**
 * Subscription statuses that are considered active (allow access to features)
 */
export const ACTIVE_STATUSES = [SUBSCRIPTION_STATUSES[0], SUBSCRIPTION_STATUSES[3]];

/**
 * Maximum file sizes (in bytes)
 */
export const FILE_SIZE_LIMITS = {
  PDF: 50 * 1024 * 1024, // 50 MB
  IMAGE: 10 * 1024 * 1024, // 10 MB
  AVATAR: 2 * 1024 * 1024, // 2 MB
  DEFAULT: 25 * 1024 * 1024, // 25 MB
};

/**
 * Rate limiting defaults
 */
export const RATE_LIMITS = {
  AUTH: {
    limit: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  EMAIL: {
    limit: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  SEARCH: {
    limit: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  API: {
    limit: 100,
    windowMs: 60 * 1000, // 1 minute
  },
};

/**
 * Session configuration
 */
export const SESSION_CONFIG = {
  CLEANUP_HOURS: 24, // Delete sessions inactive for this many hours
  ALARM_INTERVAL_MS: 60 * 60 * 1000, // Check every hour
};

/**
 * Email retry configuration
 */
export const EMAIL_RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 1000, // 1 second base delay
  MAX_DELAY_MS: 30000, // 30 seconds max delay
  BACKOFF_MULTIPLIER: 2,
};

/**
 * Note: Error codes have been moved to @corates/shared package
 * Use createDomainError() and error constants from @corates/shared instead
 */

/**
 * Time duration constants
 */
export const TIME_DURATIONS = {
  // Project Invitation expiry (7 days)
  INVITATION_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000,
  INVITATION_EXPIRY_SEC: 7 * 24 * 60 * 60,
  // Account merge verification (15 minutes)
  MERGE_VERIFICATION_EXPIRY_MS: 15 * 60 * 1000,
  // Admin impersonation session (1 hour)
  IMPERSONATION_SESSION_SEC: 60 * 60,
  // Stats query recent days
  STATS_RECENT_DAYS: 7,
  STATS_RECENT_DAYS_SEC: 7 * 24 * 60 * 60,
  // One day in various units
  ONE_DAY_MS: 24 * 60 * 60 * 1000,
  ONE_DAY_SEC: 24 * 60 * 60,
  // One hour
  ONE_HOUR_MS: 60 * 60 * 1000,
  ONE_HOUR_SEC: 60 * 60,
};

/**
 * Grant/billing configuration
 */
export const GRANT_CONFIG = {
  DURATION_MONTHS: 6,
};

/**
 * Cache duration constants (in seconds for HTTP headers)
 */
export const CACHE_DURATIONS = {
  CORS_PREFLIGHT_SEC: 24 * 60 * 60, // 24 hours
  AVATAR_SEC: 365 * 24 * 60 * 60, // 1 year
  PDF_SEC: 60 * 60, // 1 hour
  HSTS_SEC: 180 * 24 * 60 * 60, // 180 days
};

/**
 * Query and pagination limits
 */
export const QUERY_LIMITS = {
  R2_LIST_BATCH_SIZE: 1000,
  LEDGER_QUERY_LIMIT: 100,
  STORAGE_PROCESSING_CAP: 10000,
  RECENT_FAILURES_DISPLAY: 5,
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
};

/**
 * Organization limits
 */
export const ORG_LIMITS = {
  MEMBERSHIP_LIMIT: 100,
};

/**
 * Webhook configuration
 */
export const WEBHOOK_CONFIG = {
  FAILURE_THRESHOLD: 100,
};

/**
 * Check if a role is valid
 * @param {string} role - Role to validate
 * @returns {boolean}
 */
export function isValidRole(role) {
  return PROJECT_ROLES.includes(role);
}

/**
 * Check if a role can edit content
 * @param {string} role - Role to check
 * @returns {boolean}
 */
export function canEdit(role) {
  return EDIT_ROLES.includes(role);
}

/**
 * Check if a role can manage members
 * @param {string} role - Role to check
 * @returns {boolean}
 */
export function canManageMembers(role) {
  return ADMIN_ROLES.includes(role);
}

/**
 * Check if a subscription tier is valid
 * @param {string} tier - Tier to validate
 * @returns {boolean}
 */
export function isValidSubscriptionTier(tier) {
  return SUBSCRIPTION_TIERS.includes(tier);
}

/**
 * Check if a subscription status is valid
 * @param {string} status - Status to validate
 * @returns {boolean}
 */
export function isValidSubscriptionStatus(status) {
  return SUBSCRIPTION_STATUSES.includes(status);
}
