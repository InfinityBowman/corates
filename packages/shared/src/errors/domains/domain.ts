/**
 * Domain error codes - business logic errors from backend API
 * Organized by domain: auth, validation, project, file, user, system
 */

// Authentication errors
export const AUTH_ERRORS = {
  REQUIRED: {
    code: 'AUTH_REQUIRED',
    defaultMessage: 'Sign in to continue.',
    statusCode: 401,
  },
  INVALID: {
    code: 'AUTH_INVALID',
    defaultMessage: 'Invalid credentials',
    statusCode: 401,
  },
  EXPIRED: {
    code: 'AUTH_EXPIRED',
    defaultMessage: 'Your session expired. Sign in again.',
    statusCode: 401,
  },
  FORBIDDEN: {
    code: 'AUTH_FORBIDDEN',
    defaultMessage: 'Access denied',
    statusCode: 403,
  },
  // A linked third-party provider (e.g. Google) is missing or needs
  // reconnecting. Unlike REQUIRED/EXPIRED, the CoRATES session itself is fine,
  // so the client must not redirect to sign-in.
  PROVIDER_NOT_CONNECTED: {
    code: 'AUTH_PROVIDER_NOT_CONNECTED',
    defaultMessage: 'That provider is not connected. Connect it in Settings, then try again.',
    statusCode: 401,
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
    defaultMessage: 'This value is not in the right format.',
    statusCode: 400,
  },
  FIELD_TOO_LONG: {
    code: 'VALIDATION_FIELD_TOO_LONG',
    defaultMessage: 'This value is too long.',
    statusCode: 400,
  },
  FIELD_TOO_SHORT: {
    code: 'VALIDATION_FIELD_TOO_SHORT',
    defaultMessage: 'This value is too short.',
    statusCode: 400,
  },
  MULTI_FIELD: {
    code: 'VALIDATION_MULTI_FIELD',
    defaultMessage: 'Some fields need to be corrected.',
    statusCode: 400,
  },
  FAILED: {
    code: 'VALIDATION_FAILED',
    defaultMessage: 'Some of the information you entered is not valid.',
    statusCode: 400,
  },
  INVALID_INPUT: {
    code: 'VALIDATION_INVALID_INPUT',
    defaultMessage: 'Check what you entered and try again.',
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
    defaultMessage: 'This project belongs to a different organization.',
    statusCode: 403,
  },
  ACCESS_DENIED: {
    code: 'PROJECT_ACCESS_DENIED',
    defaultMessage: 'You do not have access to this project.',
    statusCode: 403,
  },
  MEMBER_ALREADY_EXISTS: {
    code: 'PROJECT_MEMBER_ALREADY_EXISTS',
    defaultMessage: 'That user is already a member of this project.',
    statusCode: 409,
  },
  LAST_OWNER: {
    code: 'PROJECT_LAST_OWNER',
    defaultMessage: 'A project must have at least one owner.',
    statusCode: 400,
  },
  INVALID_ROLE: {
    code: 'PROJECT_INVALID_ROLE',
    defaultMessage: 'That is not a valid project role.',
    statusCode: 400,
  },
  INVITATION_ALREADY_ACCEPTED: {
    code: 'PROJECT_INVITATION_ALREADY_ACCEPTED',
    defaultMessage: 'This invitation has already been accepted.',
    statusCode: 400,
  },
} as const;

export type ProjectErrorCode = (typeof PROJECT_ERRORS)[keyof typeof PROJECT_ERRORS]['code'];

// File errors
export const FILE_ERRORS = {
  TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    defaultMessage: 'This file is larger than the size limit.',
    statusCode: 413,
  },
  INVALID_TYPE: {
    code: 'FILE_INVALID_TYPE',
    defaultMessage: 'This file type is not supported.',
    statusCode: 400,
  },
  NOT_FOUND: {
    code: 'FILE_NOT_FOUND',
    defaultMessage: 'This file could not be found.',
    statusCode: 404,
  },
  UPLOAD_FAILED: {
    code: 'FILE_UPLOAD_FAILED',
    defaultMessage: 'The upload did not finish. Try again.',
    statusCode: 500,
  },
  ALREADY_EXISTS: {
    code: 'FILE_ALREADY_EXISTS',
    defaultMessage: 'A file with this name already exists.',
    statusCode: 409,
  },
  // External file sits behind a paywall/login at its source. Distinct from
  // AUTH_REQUIRED, which means the CoRATES session is missing and triggers a
  // sign-in redirect on the client.
  ACCESS_RESTRICTED: {
    code: 'FILE_ACCESS_RESTRICTED',
    defaultMessage: 'This file is behind a paywall or sign-in at its source.',
    statusCode: 403,
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
    defaultMessage: 'Your email address is not verified yet. Verify it to continue.',
    statusCode: 403,
  },
} as const;

export type UserErrorCode = (typeof USER_ERRORS)[keyof typeof USER_ERRORS]['code'];

// System errors
export const SYSTEM_ERRORS = {
  DB_ERROR: {
    code: 'SYSTEM_DB_ERROR',
    defaultMessage: 'A database error stopped this request. Try again in a moment.',
    statusCode: 500,
  },
  DB_TRANSACTION_FAILED: {
    code: 'SYSTEM_DB_TRANSACTION_FAILED',
    defaultMessage: 'The change could not be saved. Nothing was changed. Try again in a moment.',
    statusCode: 500,
  },
  EMAIL_SEND_FAILED: {
    code: 'SYSTEM_EMAIL_SEND_FAILED',
    defaultMessage: 'The email could not be sent. Try again in a moment.',
    statusCode: 500,
  },
  EMAIL_INVALID: {
    code: 'SYSTEM_EMAIL_INVALID',
    defaultMessage: 'That email address is not valid.',
    statusCode: 400,
  },
  RATE_LIMITED: {
    code: 'SYSTEM_RATE_LIMITED',
    defaultMessage: 'Too many requests. Wait a moment and try again.',
    statusCode: 429,
  },
  INTERNAL_ERROR: {
    code: 'SYSTEM_INTERNAL_ERROR',
    defaultMessage: 'Something went wrong on our end. Try again in a moment.',
    statusCode: 500,
  },
  SERVICE_UNAVAILABLE: {
    code: 'SYSTEM_SERVICE_UNAVAILABLE',
    defaultMessage: 'CoRATES is temporarily unavailable. Try again in a few minutes.',
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
