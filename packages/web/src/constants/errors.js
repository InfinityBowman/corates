/**
 * Centralized error codes for the frontend application
 * Mirrors the backend ERROR_CODES structure in packages/workers/src/config/constants.js
 * Maps backend numeric codes to frontend string constants with user-friendly messages
 */

/**
 * Error codes that map to backend error codes (1xxx-9xxx)
 * and frontend-specific errors (no backend code)
 */
export const ERROR_CODES = {
  // Authentication errors (1xxx) - map to backend codes
  AUTH_REQUIRED: {
    code: 'AUTH_REQUIRED',
    backendCode: 1001,
    message: 'Authentication required',
  },
  AUTH_INVALID: {
    code: 'AUTH_INVALID',
    backendCode: 1002,
    message: 'Invalid credentials',
  },
  AUTH_EXPIRED: {
    code: 'AUTH_EXPIRED',
    backendCode: 1003,
    message: 'Session expired',
  },
  AUTH_FORBIDDEN: {
    code: 'AUTH_FORBIDDEN',
    backendCode: 1004,
    message: 'Access denied',
  },

  // Validation errors (2xxx)
  VALIDATION_FAILED: {
    code: 'VALIDATION_FAILED',
    backendCode: 2001,
    message: 'Validation failed',
  },
  INVALID_INPUT: {
    code: 'INVALID_INPUT',
    backendCode: 2002,
    message: 'Invalid input',
  },
  MISSING_FIELD: {
    code: 'MISSING_FIELD',
    backendCode: 2003,
    message: 'Required field missing',
  },

  // Resource errors (3xxx)
  NOT_FOUND: {
    code: 'NOT_FOUND',
    backendCode: 3001,
    message: 'Resource not found',
  },
  ALREADY_EXISTS: {
    code: 'ALREADY_EXISTS',
    backendCode: 3002,
    message: 'Resource already exists',
  },
  CONFLICT: {
    code: 'CONFLICT',
    backendCode: 3003,
    message: 'Resource conflict',
  },

  // Project errors (4xxx)
  PROJECT_NOT_FOUND: {
    code: 'PROJECT_NOT_FOUND',
    backendCode: 4001,
    message: 'Project not found',
  },
  PROJECT_ACCESS_DENIED: {
    code: 'PROJECT_ACCESS_DENIED',
    backendCode: 4002,
    message: 'Project access denied',
  },
  PROJECT_MEMBER_EXISTS: {
    code: 'PROJECT_MEMBER_EXISTS',
    backendCode: 4003,
    message: 'User is already a member',
  },
  PROJECT_LAST_OWNER: {
    code: 'PROJECT_LAST_OWNER',
    backendCode: 4004,
    message: 'Cannot remove the last owner',
  },
  INVALID_ROLE: {
    code: 'INVALID_ROLE',
    backendCode: 4005,
    message: 'Invalid role specified',
  },

  // File errors (5xxx)
  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    backendCode: 5001,
    message: 'File exceeds size limit',
  },
  FILE_INVALID_TYPE: {
    code: 'FILE_INVALID_TYPE',
    backendCode: 5002,
    message: 'Invalid file type',
  },
  FILE_NOT_FOUND: {
    code: 'FILE_NOT_FOUND',
    backendCode: 5003,
    message: 'File not found',
  },
  FILE_UPLOAD_FAILED: {
    code: 'FILE_UPLOAD_FAILED',
    backendCode: 5004,
    message: 'File upload failed',
  },
  FILE_ALREADY_EXISTS: {
    code: 'FILE_ALREADY_EXISTS',
    backendCode: 5005,
    message: 'File already exists',
  },

  // Database errors (6xxx)
  DB_ERROR: {
    code: 'DB_ERROR',
    backendCode: 6001,
    message: 'Database error',
  },
  DB_TRANSACTION_FAILED: {
    code: 'DB_TRANSACTION_FAILED',
    backendCode: 6002,
    message: 'Transaction failed',
  },

  // Email errors (7xxx)
  EMAIL_SEND_FAILED: {
    code: 'EMAIL_SEND_FAILED',
    backendCode: 7001,
    message: 'Failed to send email',
  },
  EMAIL_INVALID: {
    code: 'EMAIL_INVALID',
    backendCode: 7002,
    message: 'Invalid email address',
  },
  EMAIL_NOT_VERIFIED: {
    code: 'EMAIL_NOT_VERIFIED',
    message: 'Email not verified. Please verify your email address.',
  },

  // Rate limiting (8xxx)
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    backendCode: 8001,
    message: 'Too many requests. Please try again later.',
  },

  // Server errors (9xxx)
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    backendCode: 9001,
    message: 'Internal server error',
  },
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    backendCode: 9002,
    message: 'Service temporarily unavailable',
  },

  // Frontend-specific errors (no backend code)
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    message:
      'Unable to connect to the server. Please check your internet connection and try again.',
  },
  TIMEOUT_ERROR: {
    code: 'TIMEOUT_ERROR',
    message: 'The request timed out. Please try again.',
  },
  USER_NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    message: 'No account found with this email',
  },
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    message: 'Incorrect email or password',
  },
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    message: 'Something went wrong. Please try again.',
  },
};

/**
 * Map backend numeric error codes to frontend error code constants
 */
const BACKEND_CODE_MAP = {};
for (const [key, value] of Object.entries(ERROR_CODES)) {
  if (value.backendCode) {
    BACKEND_CODE_MAP[value.backendCode] = key;
  }
}

/**
 * Get frontend error code from backend numeric code
 * @param {number} backendCode - Backend error code (e.g., 1001)
 * @returns {string|null} Frontend error code constant or null if not found
 */
export function mapBackendCodeToFrontend(backendCode) {
  return BACKEND_CODE_MAP[backendCode] || null;
}

/**
 * Get user-friendly error message from error code
 * @param {string} errorCode - Frontend error code constant
 * @returns {string} User-friendly error message
 */
export function getErrorMessage(errorCode) {
  if (!errorCode) {
    return ERROR_CODES.UNKNOWN_ERROR.message;
  }
  const errorDef = ERROR_CODES[errorCode];
  return errorDef ? errorDef.message : ERROR_CODES.UNKNOWN_ERROR.message;
}

/**
 * Error messages that indicate access to a project has been denied.
 * Used to detect when a user should be redirected away from a project view.
 * These are derived from project-related error codes and connection errors.
 */
export const ACCESS_DENIED_ERRORS = [
  'This project has been deleted',
  'You have been removed from this project',
  'You are not a member of this project',
  'Unable to connect to project. It may have been deleted or you may not have access.',
  ERROR_CODES.PROJECT_NOT_FOUND.message,
  ERROR_CODES.PROJECT_ACCESS_DENIED.message,
];
