/**
 * Domain error codes - business logic errors from backend API
 * Organized by domain: auth, validation, project, file, user, system
 */

// Authentication errors
export const AUTH_ERRORS = {
  REQUIRED: {
    code: 'AUTH_REQUIRED',
    defaultMessage: 'Authentication required',
    statusCode: 401,
  },
  INVALID: {
    code: 'AUTH_INVALID',
    defaultMessage: 'Invalid credentials',
    statusCode: 401,
  },
  EXPIRED: {
    code: 'AUTH_EXPIRED',
    defaultMessage: 'Session expired',
    statusCode: 401,
  },
  FORBIDDEN: {
    code: 'AUTH_FORBIDDEN',
    defaultMessage: 'Access denied',
    statusCode: 403,
  },
} as const;

export type AuthErrorCode = (typeof AUTH_ERRORS)[keyof typeof AUTH_ERRORS]['code'];

// Validation errors
export const VALIDATION_ERRORS = {
  FIELD_REQUIRED: {
    code: 'VALIDATION_FIELD_REQUIRED',
    defaultMessage: 'This field is required',
    statusCode: 400,
  },
  FIELD_INVALID_FORMAT: {
    code: 'VALIDATION_FIELD_INVALID_FORMAT',
    defaultMessage: 'Invalid format',
    statusCode: 400,
  },
  FIELD_TOO_LONG: {
    code: 'VALIDATION_FIELD_TOO_LONG',
    defaultMessage: 'Value is too long',
    statusCode: 400,
  },
  FIELD_TOO_SHORT: {
    code: 'VALIDATION_FIELD_TOO_SHORT',
    defaultMessage: 'Value is too short',
    statusCode: 400,
  },
  MULTI_FIELD: {
    code: 'VALIDATION_MULTI_FIELD',
    defaultMessage: 'Validation failed for multiple fields',
    statusCode: 400,
  },
  FAILED: {
    code: 'VALIDATION_FAILED',
    defaultMessage: 'Validation failed',
    statusCode: 400,
  },
  INVALID_INPUT: {
    code: 'VALIDATION_INVALID_INPUT',
    defaultMessage: 'Invalid input',
    statusCode: 400,
  },
} as const;

export type ValidationErrorCode =
  (typeof VALIDATION_ERRORS)[keyof typeof VALIDATION_ERRORS]['code'];

// Project errors
export const PROJECT_ERRORS = {
  NOT_FOUND: {
    code: 'PROJECT_NOT_FOUND',
    defaultMessage: 'Project not found',
    statusCode: 404,
  },
  NOT_IN_ORG: {
    code: 'PROJECT_NOT_IN_ORG',
    defaultMessage: 'Project does not belong to this organization',
    statusCode: 403,
  },
  ACCESS_DENIED: {
    code: 'PROJECT_ACCESS_DENIED',
    defaultMessage: 'You do not have access to this project',
    statusCode: 403,
  },
  MEMBER_ALREADY_EXISTS: {
    code: 'PROJECT_MEMBER_ALREADY_EXISTS',
    defaultMessage: 'User is already a member of this project',
    statusCode: 409,
  },
  LAST_OWNER: {
    code: 'PROJECT_LAST_OWNER',
    defaultMessage: 'Cannot remove the last owner',
    statusCode: 400,
  },
  INVALID_ROLE: {
    code: 'PROJECT_INVALID_ROLE',
    defaultMessage: 'Invalid role specified',
    statusCode: 400,
  },
  INVITATION_ALREADY_ACCEPTED: {
    code: 'PROJECT_INVITATION_ALREADY_ACCEPTED',
    defaultMessage: 'Invitation has already been accepted',
    statusCode: 400,
  },
} as const;

export type ProjectErrorCode = (typeof PROJECT_ERRORS)[keyof typeof PROJECT_ERRORS]['code'];

// File errors
export const FILE_ERRORS = {
  TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    defaultMessage: 'File exceeds size limit',
    statusCode: 413,
  },
  INVALID_TYPE: {
    code: 'FILE_INVALID_TYPE',
    defaultMessage: 'Invalid file type',
    statusCode: 400,
  },
  NOT_FOUND: {
    code: 'FILE_NOT_FOUND',
    defaultMessage: 'File not found',
    statusCode: 404,
  },
  UPLOAD_FAILED: {
    code: 'FILE_UPLOAD_FAILED',
    defaultMessage: 'File upload failed',
    statusCode: 500,
  },
  ALREADY_EXISTS: {
    code: 'FILE_ALREADY_EXISTS',
    defaultMessage: 'File already exists',
    statusCode: 409,
  },
} as const;

export type FileErrorCode = (typeof FILE_ERRORS)[keyof typeof FILE_ERRORS]['code'];

// User errors
export const USER_ERRORS = {
  NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    defaultMessage: 'User not found',
    statusCode: 404,
  },
  EMAIL_NOT_VERIFIED: {
    code: 'USER_EMAIL_NOT_VERIFIED',
    defaultMessage: 'Email not verified. Please verify your email address.',
    statusCode: 403,
  },
} as const;

export type UserErrorCode = (typeof USER_ERRORS)[keyof typeof USER_ERRORS]['code'];

// System errors
export const SYSTEM_ERRORS = {
  DB_ERROR: {
    code: 'SYSTEM_DB_ERROR',
    defaultMessage: 'Database error',
    statusCode: 500,
  },
  DB_TRANSACTION_FAILED: {
    code: 'SYSTEM_DB_TRANSACTION_FAILED',
    defaultMessage: 'Transaction failed',
    statusCode: 500,
  },
  EMAIL_SEND_FAILED: {
    code: 'SYSTEM_EMAIL_SEND_FAILED',
    defaultMessage: 'Failed to send email',
    statusCode: 500,
  },
  EMAIL_INVALID: {
    code: 'SYSTEM_EMAIL_INVALID',
    defaultMessage: 'Invalid email address',
    statusCode: 400,
  },
  RATE_LIMITED: {
    code: 'SYSTEM_RATE_LIMITED',
    defaultMessage: 'Too many requests. Please try again later.',
    statusCode: 429,
  },
  INTERNAL_ERROR: {
    code: 'SYSTEM_INTERNAL_ERROR',
    defaultMessage: 'Internal server error',
    statusCode: 500,
  },
  SERVICE_UNAVAILABLE: {
    code: 'SYSTEM_SERVICE_UNAVAILABLE',
    defaultMessage: 'Service temporarily unavailable',
    statusCode: 503,
  },
  ROUTE_NOT_FOUND: {
    code: 'SYSTEM_ROUTE_NOT_FOUND',
    defaultMessage: 'Route not found',
    statusCode: 404,
  },
} as const;

export type SystemErrorCode = (typeof SYSTEM_ERRORS)[keyof typeof SYSTEM_ERRORS]['code'];

// Export all domain errors
export const DOMAIN_ERRORS = {
  ...AUTH_ERRORS,
  ...VALIDATION_ERRORS,
  ...PROJECT_ERRORS,
  ...FILE_ERRORS,
  ...USER_ERRORS,
  ...SYSTEM_ERRORS,
} as const;
