/**
 * Error normalization - strict validation, no guessing
 * Only handles transport errors and unknown errors - domain errors come from parseApiError
 */

import type { DomainError, TransportError } from './types.js';
import { createTransportError, getErrorMessage, createUnknownError } from './helpers.js';

/**
 * Validate error shape matches AppError
 */
function isAppError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

/**
 * Validate domain error (from API) - must have statusCode, not transport/unknown
 */
export function isDomainError(error: unknown): error is DomainError {
  if (!isAppError(error)) return false;
  return (
    typeof (error as { statusCode?: unknown }).statusCode === 'number' &&
    !error.code.startsWith('TRANSPORT_') &&
    !error.code.startsWith('UNKNOWN_')
  );
}

/**
 * Validate transport error
 */
export function isTransportError(error: unknown): error is TransportError {
  return isAppError(error) && error.code.startsWith('TRANSPORT_');
}

/**
 * Normalize error - strict validation, no fallback guessing
 * Only handles transport errors and unknown errors - domain errors come from parseApiError
 */
export function normalizeError(error: unknown): TransportError | DomainError {
  // If already valid error, return as-is
  if (isDomainError(error)) {
    return error;
  }

  if (isTransportError(error)) {
    return error;
  }

  // If Error object from network/fetch, create transport error (strict matching)
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // Network errors - strict patterns
    if (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('load failed') ||
      msg.includes('cors')
    ) {
      return createTransportError(
        'TRANSPORT_NETWORK_ERROR',
        getErrorMessage('TRANSPORT_NETWORK_ERROR'),
        {
          originalError: error.message,
        },
      );
    }

    // Timeout errors
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return createTransportError('TRANSPORT_TIMEOUT', getErrorMessage('TRANSPORT_TIMEOUT'), {
        originalError: error.message,
      });
    }
  }

  // Response objects should never reach normalizeError - use parseApiError instead
  // Check for Response-like objects (has ok, status, json properties)
  if (
    error &&
    typeof error === 'object' &&
    'ok' in error &&
    'status' in error &&
    'json' in error &&
    typeof (error as { json: unknown }).json === 'function'
  ) {
    console.error(
      'Programmer error: Response object passed to normalizeError. Use parseApiError instead.',
    );
    return createUnknownError(
      'UNKNOWN_PROGRAMMER_ERROR',
      'Response object passed to normalizeError',
    );
  }

  // Unknown error - log and return safe error (no guessing)
  console.error('Unknown error normalized:', error);
  return createUnknownError('UNKNOWN_UNHANDLED_ERROR', 'An unexpected error occurred', {
    originalError: String(error),
  });
}
