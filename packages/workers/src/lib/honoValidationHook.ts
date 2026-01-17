/**
 * Shared validation hook for OpenAPIHono routes
 * Provides consistent error handling for Zod validation failures
 */

import type { Context } from 'hono';
import type { z } from 'zod';
import { createValidationError, VALIDATION_ERRORS, type ValidationErrorCode } from '@corates/shared';

interface ValidationResult {
  success: boolean;
  error?: z.ZodError;
  target: string;
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
export function validationHook(result: ValidationResult, c: Context): Response | undefined {
  if (!result.success && result.error) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue?.path?.[0] || 'input';
    const fieldName = String(field).charAt(0).toUpperCase() + String(field).slice(1);

    let message = firstIssue?.message || 'Validation failed';

    // Cast code to string for runtime comparison (Zod has more codes than TypeScript types show)
    const issueCode = firstIssue?.code as string;

    // Check for missing field conditions across different Zod versions
    // Handle both string 'undefined' and actual undefined values from Zod
    const issueReceived = (firstIssue as { received?: unknown })?.received;
    const receivedIsUndefined =
      typeof issueReceived === 'undefined' ||
      issueReceived === 'undefined' ||
      String(issueReceived) === 'undefined';
    // Missing field scenarios:
    // - invalid_type with undefined received
    // - invalid_enum_value with undefined received (missing required enum field)
    // - message contains 'received undefined' or 'Required'
    const isMissing =
      ((issueCode === 'invalid_type' || issueCode === 'invalid_enum_value') && receivedIsUndefined) ||
      message.includes('received undefined') ||
      message.includes('Required');

    // Select the appropriate error code based on failure type
    let selectedErrorCode: ValidationErrorCode;
    if (isMissing) {
      message = `${fieldName} is required`;
      selectedErrorCode = VALIDATION_ERRORS.FIELD_REQUIRED.code;
    } else if (issueCode === 'too_big') {
      selectedErrorCode = VALIDATION_ERRORS.FIELD_TOO_LONG.code;
    } else if (issueCode === 'too_small') {
      selectedErrorCode = VALIDATION_ERRORS.FIELD_TOO_SHORT.code;
    } else if (issueCode === 'invalid_format' || issueCode === 'invalid_string') {
      selectedErrorCode = VALIDATION_ERRORS.FIELD_INVALID_FORMAT.code;
    } else {
      selectedErrorCode = VALIDATION_ERRORS.INVALID_INPUT.code;
    }

    const error = createValidationError(String(field), selectedErrorCode, null);
    error.message = message;
    return c.json(error, 400);
  }
  return undefined;
}
