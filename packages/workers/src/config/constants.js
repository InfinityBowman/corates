/**
 * Centralized constants for the workers package
 * All shared constants should be defined here to avoid duplication
 */

/**
 * Valid project member roles
 */
export const PROJECT_ROLES = ['owner', 'collaborator', 'member', 'viewer'];

/**
 * Roles that can edit project content
 */
export const EDIT_ROLES = ['owner', 'collaborator', 'member'];

/**
 * Roles that can manage project members
 */
export const ADMIN_ROLES = ['owner'];

/**
 * Maximum file sizes (in bytes)
 */
export const FILE_SIZE_LIMITS = {
  PDF: 50 * 1024 * 1024, // 50 MB
  IMAGE: 10 * 1024 * 1024, // 10 MB
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
