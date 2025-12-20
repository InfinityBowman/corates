/**
 * Runtime validation for error responses
 * Ensures domain errors have proper shape and rejects transport/unknown codes from API
 */

import type { DomainError } from './types.js';
import { createUnknownError } from './helpers.js';

/**
 * Validate API error response matches DomainError shape
 */
export function validateErrorResponse(data: unknown): DomainError {
  if (!data || typeof data !== 'object') {
    return createUnknownError('UNKNOWN_INVALID_RESPONSE', 'Invalid error response');
  }

  const error = data as Record<string, unknown>;

  // Must have code and message
  if (typeof error.code !== 'string' || typeof error.message !== 'string') {
    return createUnknownError('UNKNOWN_INVALID_RESPONSE', 'Error response missing code or message');
  }

  // Domain errors must have statusCode
  if (typeof error.statusCode !== 'number') {
    return createUnknownError('UNKNOWN_INVALID_RESPONSE', 'Error response missing statusCode');
  }

  // Validate code is not transport/unknown (those shouldn't come from API)
  if (error.code.startsWith('TRANSPORT_') || error.code.startsWith('UNKNOWN_')) {
    return createUnknownError(
      'UNKNOWN_INVALID_RESPONSE',
      `Invalid error code from API: ${error.code}`,
    );
  }

  // Return validated domain error
  return {
    code: error.code,
    message: error.message,
    details: error.details as DomainError['details'],
    statusCode: error.statusCode,
    timestamp: (typeof error.timestamp === 'string' ?
      error.timestamp
    : new Date().toISOString()) as string,
  };
}
