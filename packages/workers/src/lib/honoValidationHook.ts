/**
 * Shared validation hook for OpenAPIHono routes
 * Provides consistent error handling for Zod validation failures
 */

import type { Context } from 'hono';
import type { z } from 'zod';
import { createValidationError, VALIDATION_ERRORS } from '@corates/shared';

interface ValidationResult {
  success: boolean;
  error?: z.ZodError;
}

/**
 * Creates a validation error response from a Zod validation failure.
 * Extracts the first issue and formats a user-friendly error message.
 *
 * Usage:
 * ```ts
 * const routes = new OpenAPIHono({
 *   defaultHook: validationHook,
 * });
 * ```
 */
export function validationHook(
  result: ValidationResult,
  c: Context,
): Response | undefined {
  if (!result.success && result.error) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue?.path?.[0] || 'input';
    const fieldName = String(field).charAt(0).toUpperCase() + String(field).slice(1);

    let message = firstIssue?.message || 'Validation failed';

    // Check for missing field conditions across different Zod versions
    const issueReceived = (firstIssue as { received?: unknown })?.received;
    const isMissing =
      firstIssue?.code === 'invalid_type' ||
      issueReceived === 'undefined' ||
      message.includes('received undefined') ||
      message.includes('Required');

    if (isMissing) {
      message = `${fieldName} is required`;
    }

    const error = createValidationError(String(field), VALIDATION_ERRORS.FIELD_REQUIRED.code, null);
    error.message = message;
    return c.json(error, 400);
  }
  return undefined;
}
