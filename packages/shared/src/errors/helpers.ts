/**
 * Error creation helpers
 * Functions to create properly typed error objects
 */

import type {
  DomainError,
  TransportError,
  ErrorDefinition,
  ErrorDetails,
  ValidationErrorDetails,
} from './types.js';
import {
  VALIDATION_ERRORS,
  AUTH_ERRORS,
  PROJECT_ERRORS,
  FILE_ERRORS,
  USER_ERRORS,
  SYSTEM_ERRORS,
  type ValidationErrorCode,
} from './domains/domain.js';
import { UNKNOWN_ERRORS, type UnknownErrorCode } from './domains/unknown.js';
import { TRANSPORT_ERRORS, type TransportErrorCode } from './domains/transport.js';
import type { SystemErrorDetails } from './types.js';

/**
 * Create domain error with typed details
 */
export function createDomainError(
  errorDef: ErrorDefinition,
  details?: ErrorDetails,
  messageOverride?: string,
): DomainError {
  return {
    code: errorDef.code,
    message: messageOverride || errorDef.defaultMessage,
    details,
    statusCode: errorDef.statusCode,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create validation error with typed details
 */
export function createValidationError(
  field: string,
  errorCode: ValidationErrorCode,
  value?: unknown,
  constraint?: string,
): DomainError {
  // Find error definition by matching code value (not key)
  const errorDef = Object.values(VALIDATION_ERRORS).find(e => e.code === errorCode);
  if (!errorDef) {
    throw new Error(`Invalid validation error code: ${errorCode}`);
  }
  return {
    code: errorCode,
    message: errorDef.defaultMessage,
    details: { field, value, constraint } as ValidationErrorDetails,
    statusCode: errorDef.statusCode,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create multi-field validation error
 */
export function createMultiFieldValidationError(
  errors: Array<{ field: string; code: ValidationErrorCode; message: string }>,
): DomainError {
  return {
    code: 'VALIDATION_MULTI_FIELD',
    message: VALIDATION_ERRORS.MULTI_FIELD.defaultMessage,
    details: {
      fields: errors.map(e => ({ field: e.field, message: e.message })),
    } as ValidationErrorDetails,
    statusCode: 400,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create transport error (frontend only)
 */
export function createTransportError(
  code: TransportErrorCode,
  message?: string,
  details?: TransportError['details'],
): TransportError {
  // Find the error definition by matching code
  const errorDef = Object.values(TRANSPORT_ERRORS).find(e => e.code === code);
  if (!errorDef) {
    throw new Error(`Invalid transport error code: ${code}`);
  }
  return {
    code,
    message: message || errorDef.defaultMessage,
    details,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create unknown error (fallback)
 */
export function createUnknownError(
  code: UnknownErrorCode,
  message: string,
  details?: SystemErrorDetails,
): DomainError {
  // Find the error definition by matching code
  const errorDef = Object.values(UNKNOWN_ERRORS).find(e => e.code === code);
  if (!errorDef) {
    throw new Error(`Invalid unknown error code: ${code}`);
  }
  return {
    code,
    message,
    details,
    statusCode: errorDef.statusCode,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get error message for a code
 */
export function getErrorMessage(code: string): string {
  // Check domain errors
  const allDomainErrors = [
    ...Object.values(AUTH_ERRORS),
    ...Object.values(VALIDATION_ERRORS),
    ...Object.values(PROJECT_ERRORS),
    ...Object.values(FILE_ERRORS),
    ...Object.values(USER_ERRORS),
    ...Object.values(SYSTEM_ERRORS),
  ];
  const domainError = allDomainErrors.find(e => e.code === code);
  if (domainError) {
    return domainError.defaultMessage;
  }

  // Check transport errors
  const transportError = Object.values(TRANSPORT_ERRORS).find(e => e.code === code);
  if (transportError) {
    return transportError.defaultMessage;
  }

  // Check unknown errors
  const unknownError = Object.values(UNKNOWN_ERRORS).find(e => e.code === code);
  if (unknownError) {
    return unknownError.defaultMessage;
  }

  return 'An unexpected error occurred';
}
