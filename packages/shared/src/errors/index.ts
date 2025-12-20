/**
 * Public API exports for error system
 * This is the main entry point for consuming packages
 */

// Types
export type {
  AppError,
  DomainError,
  TransportError,
  ErrorDetails,
  ErrorDefinition,
  DomainErrorCode,
  ValidationErrorDetails,
  ProjectErrorDetails,
  FileErrorDetails,
  AuthErrorDetails,
  SystemErrorDetails,
  TransportErrorDetails,
} from './types.js';

// Domain error codes
export {
  AUTH_ERRORS,
  VALIDATION_ERRORS,
  PROJECT_ERRORS,
  FILE_ERRORS,
  USER_ERRORS,
  SYSTEM_ERRORS,
  DOMAIN_ERRORS,
  type AuthErrorCode,
  type ValidationErrorCode,
  type ProjectErrorCode,
  type FileErrorCode,
  type UserErrorCode,
  type SystemErrorCode,
} from './domains/domain.js';

// Transport error codes
export { TRANSPORT_ERRORS, type TransportErrorCode } from './domains/transport.js';

// Unknown error codes
export { UNKNOWN_ERRORS, type UnknownErrorCode } from './domains/unknown.js';

// Helpers
export {
  createDomainError,
  createValidationError,
  createMultiFieldValidationError,
  createTransportError,
  createUnknownError,
  getErrorMessage,
} from './helpers.js';

// Normalization
export { normalizeError, isDomainError, isTransportError } from './normalize.js';

// Validation
export { validateErrorResponse } from './validate.js';
