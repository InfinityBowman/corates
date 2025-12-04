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
 * Error codes for API responses
 */
export const ERROR_CODES = {
  // Authentication errors (1xxx)
  AUTH_REQUIRED: { code: 1001, message: 'Authentication required' },
  AUTH_INVALID: { code: 1002, message: 'Invalid credentials' },
  AUTH_EXPIRED: { code: 1003, message: 'Session expired' },
  AUTH_FORBIDDEN: { code: 1004, message: 'Access denied' },

  // Validation errors (2xxx)
  VALIDATION_FAILED: { code: 2001, message: 'Validation failed' },
  INVALID_INPUT: { code: 2002, message: 'Invalid input' },
  MISSING_FIELD: { code: 2003, message: 'Required field missing' },

  // Resource errors (3xxx)
  NOT_FOUND: { code: 3001, message: 'Resource not found' },
  ALREADY_EXISTS: { code: 3002, message: 'Resource already exists' },
  CONFLICT: { code: 3003, message: 'Resource conflict' },

  // Project errors (4xxx)
  PROJECT_NOT_FOUND: { code: 4001, message: 'Project not found' },
  PROJECT_ACCESS_DENIED: { code: 4002, message: 'Project access denied' },
  PROJECT_MEMBER_EXISTS: { code: 4003, message: 'User is already a member' },
  PROJECT_LAST_OWNER: { code: 4004, message: 'Cannot remove the last owner' },
  INVALID_ROLE: { code: 4005, message: 'Invalid role specified' },

  // File errors (5xxx)
  FILE_TOO_LARGE: { code: 5001, message: 'File exceeds size limit' },
  FILE_INVALID_TYPE: { code: 5002, message: 'Invalid file type' },
  FILE_NOT_FOUND: { code: 5003, message: 'File not found' },
  FILE_UPLOAD_FAILED: { code: 5004, message: 'File upload failed' },

  // Database errors (6xxx)
  DB_ERROR: { code: 6001, message: 'Database error' },
  DB_TRANSACTION_FAILED: { code: 6002, message: 'Transaction failed' },

  // Email errors (7xxx)
  EMAIL_SEND_FAILED: { code: 7001, message: 'Failed to send email' },
  EMAIL_INVALID: { code: 7002, message: 'Invalid email address' },

  // Rate limiting (8xxx)
  RATE_LIMITED: { code: 8001, message: 'Too many requests' },

  // Server errors (9xxx)
  INTERNAL_ERROR: { code: 9001, message: 'Internal server error' },
  SERVICE_UNAVAILABLE: { code: 9002, message: 'Service temporarily unavailable' },
};

/**
 * Helper to create an error response object
 * @param {Object} errorDef - Error definition from ERROR_CODES
 * @param {string} [details] - Additional details about the error
 * @returns {Object} Error response object
 */
export function createErrorResponse(errorDef, details = null) {
  const response = {
    error: errorDef.message,
    code: errorDef.code,
  };
  if (details) {
    response.details = details;
  }
  return response;
}

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
