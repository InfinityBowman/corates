/**
 * Error parsing and handling utilities
 * Uses the shared error system from @corates/shared
 * Separates domain errors (from API) from transport errors (network issues)
 */

import {
  validateErrorResponse,
  normalizeError,
  isDomainError,
  isTransportError,
  AUTH_ERRORS,
  USER_ERRORS,
} from '@corates/shared';
import { showToast } from '@corates/ui';

/**
 * User-friendly error messages for common error codes
 * These replace technical messages with helpful guidance
 */
const USER_FRIENDLY_MESSAGES = {
  // Auth errors
  AUTH_REQUIRED: 'Please sign in to continue',
  AUTH_INVALID: 'Invalid email or password',
  AUTH_EXPIRED: 'Your session has expired. Please sign in again.',
  AUTH_FORBIDDEN: "You don't have permission to do that",

  // Validation errors
  VALIDATION_FIELD_REQUIRED: 'Please fill in all required fields',
  VALIDATION_FIELD_INVALID_FORMAT: 'Please check the format of your input',
  VALIDATION_FIELD_TOO_LONG: 'The value entered is too long',
  VALIDATION_FIELD_TOO_SHORT: 'The value entered is too short',
  VALIDATION_MULTI_FIELD: 'Please fix the errors in the form',
  VALIDATION_FAILED: 'Please check your input and try again',
  VALIDATION_INVALID_INPUT: 'Please check your input and try again',

  // Project errors
  PROJECT_NOT_FOUND: 'This project could not be found',
  PROJECT_NOT_IN_ORG: "This project isn't in your organization",
  PROJECT_ACCESS_DENIED: "You don't have access to this project",
  PROJECT_MEMBER_ALREADY_EXISTS: 'This user is already a project member',
  PROJECT_LAST_OWNER: 'Projects must have at least one owner',
  PROJECT_INVALID_ROLE: 'Please select a valid role',
  PROJECT_INVITATION_ALREADY_ACCEPTED: 'This invitation has already been accepted',

  // File errors
  FILE_TOO_LARGE: 'This file is too large. Please choose a smaller file.',
  FILE_INVALID_TYPE: 'This file type is not supported',
  FILE_NOT_FOUND: 'The file could not be found',
  FILE_UPLOAD_FAILED: 'Upload failed. Please try again.',
  FILE_ALREADY_EXISTS: 'A file with this name already exists',

  // User errors
  USER_NOT_FOUND: 'User not found',
  USER_EMAIL_NOT_VERIFIED: 'Please verify your email address to continue',

  // System errors - keep these generic for users
  SYSTEM_DB_ERROR: 'Something went wrong. Please try again.',
  SYSTEM_DB_TRANSACTION_FAILED: 'Something went wrong. Please try again.',
  SYSTEM_EMAIL_SEND_FAILED: 'Unable to send email. Please try again later.',
  SYSTEM_EMAIL_INVALID: 'Please enter a valid email address',
  SYSTEM_RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  SYSTEM_INTERNAL_ERROR: 'Something went wrong. Please try again.',
  SYSTEM_SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try again later.',

  // Transport errors
  TRANSPORT_NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  TRANSPORT_TIMEOUT: 'Request timed out. Please try again.',
  TRANSPORT_CORS_ERROR: 'Connection blocked. Please try again.',

  // Unknown errors
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
  UNKNOWN_INVALID_RESPONSE: 'Something went wrong. Please try again.',
};

/**
 * Get user-friendly message for an error code
 * Falls back to the error's message if no mapping exists
 */
function getUserFriendlyMessage(error) {
  // Check if we have a friendly message for this code
  if (error.code && USER_FRIENDLY_MESSAGES[error.code]) {
    return USER_FRIENDLY_MESSAGES[error.code];
  }
  // Fall back to the error message, but clean it up
  if (error.message) {
    // If message looks like a code (ALL_CAPS_WITH_UNDERSCORES), use generic
    if (/^[A-Z][A-Z0-9_]+$/.test(error.message)) {
      return 'Something went wrong. Please try again.';
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

/**
 * Parse API error response - only returns DomainError
 * API responses only return domain errors, never transport errors
 * @param {Response} response - Fetch response object
 * @returns {Promise<DomainError>}
 */
export async function parseApiError(response) {
  try {
    const data = await response.json();
    // Validate the error response matches DomainError shape
    return validateErrorResponse(data);
  } catch (_err) {
    // If response body can't be parsed, create unknown error
    return {
      code: 'UNKNOWN_INVALID_RESPONSE',
      message: 'Invalid error response format',
      statusCode: response.status || 500,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Handle fetch errors - separates transport from domain
 * @param {Promise<Response>} fetchPromise - Promise from fetch call
 * @param {Object} options - Error handling options
 * @param {Function} [options.setError] - State setter function for inline errors
 * @param {boolean} [options.showToast=true] - Whether to show toast notification
 * @param {string} [options.toastTitle] - Custom toast title
 * @param {Function} [options.onError] - Callback function with parsed error
 * @param {Function} [options.navigate] - Navigation function for redirects
 * @returns {Promise<Response>} Response if successful, throws parsed error otherwise
 */
export async function handleFetchError(fetchPromise, options = {}) {
  try {
    const response = await fetchPromise;

    if (!response.ok) {
      // Parse domain error from API response
      const domainError = await parseApiError(response);
      await handleDomainError(domainError, options);
      throw domainError;
    }

    return response;
  } catch (error) {
    // If already a domain error, re-throw
    if (isDomainError(error)) {
      throw error;
    }

    // Normalize the error once
    const normalizedError = normalizeError(error);

    // Branch based on error type
    if (isTransportError(normalizedError)) {
      await handleTransportError(normalizedError, options);
      throw normalizedError;
    } else if (isDomainError(normalizedError)) {
      await handleDomainError(normalizedError, options);
      throw normalizedError;
    } else {
      // Fallback: treat as transport error
      await handleTransportError(normalizedError, options);
      throw normalizedError;
    }
  }
}

/**
 * Handle domain errors (from API)
 * @param {DomainError} error - Domain error from API
 * @param {Object} options - Handling options
 * @param {Function} [options.setError] - State setter function
 * @param {boolean} [options.showToast=true] - Whether to show toast
 * @param {string} [options.toastTitle] - Custom toast title
 * @param {Function} [options.onError] - Callback function
 * @param {Function} [options.navigate] - Navigation function
 */
export async function handleDomainError(error, options = {}) {
  const { setError, showToast: showToastOption = true, toastTitle, onError, navigate } = options;

  // Call custom error handler if provided
  if (onError) {
    onError(error);
  }

  // Handle navigation-required errors (no toast needed, user will be redirected)
  if (navigate) {
    if (error.code === AUTH_ERRORS.REQUIRED.code || error.code === AUTH_ERRORS.EXPIRED.code) {
      navigate('/signin', { replace: true });
      return;
    }
    if (error.code === USER_ERRORS.EMAIL_NOT_VERIFIED.code) {
      navigate('/verify-email', { replace: true });
      return;
    }
  }

  // Get user-friendly message
  const friendlyMessage = getUserFriendlyMessage(error);

  // Update error state if setter provided
  if (setError) {
    setError(friendlyMessage);
  }

  // Show toast for user-facing errors
  if (showToastOption) {
    // Use custom title if provided, otherwise use friendly message
    const title = toastTitle || friendlyMessage;
    // Only show details if they're user-meaningful (not technical)
    const details = error.details && typeof error.details === 'string' ? error.details : '';
    showToast.error(title, details);
  }
}

/**
 * Handle transport errors (network issues)
 * @param {TransportError} error - Transport error (network, timeout, etc.)
 * @param {Object} options - Handling options
 * @param {Function} [options.setError] - State setter function
 * @param {boolean} [options.showToast=true] - Whether to show toast
 * @param {string} [options.toastTitle] - Custom toast title
 * @param {Function} [options.onError] - Callback function
 */
export async function handleTransportError(error, options = {}) {
  const { setError, showToast: showToastOption = true, toastTitle, onError } = options;

  // Call custom error handler if provided
  if (onError) {
    onError(error);
  }

  // Get user-friendly message
  const friendlyMessage = getUserFriendlyMessage(error);

  // Update error state if setter provided
  if (setError) {
    setError(friendlyMessage);
  }

  // Show toast for transport errors
  if (showToastOption) {
    const title = toastTitle || 'Connection Error';
    showToast.error(title, friendlyMessage);
  }
}

/**
 * Unified error handling (backward compatibility)
 * Automatically detects domain vs transport errors
 * @param {Error|Response|DomainError|TransportError|any} error - Error to handle
 * @param {Object} options - Handling options (same as handleDomainError/handleTransportError)
 * @returns {Promise<DomainError|TransportError>} Parsed error object
 */
export async function handleError(error, options = {}) {
  // If already a domain error, handle as domain error
  if (isDomainError(error)) {
    await handleDomainError(error, options);
    return error;
  }

  // If already a transport error, handle as transport error
  if (isTransportError(error)) {
    await handleTransportError(error, options);
    return error;
  }

  // If Response object, parse as domain error
  if (error instanceof Response) {
    const domainError = await parseApiError(error);
    await handleDomainError(domainError, options);
    return domainError;
  }

  // Otherwise, normalize and handle
  const normalizedError = normalizeError(error);
  if (isTransportError(normalizedError)) {
    await handleTransportError(normalizedError, options);
  } else {
    await handleDomainError(normalizedError, options);
  }

  return normalizedError;
}

/**
 * Parse error from an Error object or string (backward compatibility)
 * @param {Error|string|any} error - Error object, string, or other error format
 * @returns {DomainError|TransportError} Normalized error
 */
export function parseError(error) {
  return normalizeError(error);
}

/**
 * Check if error code matches (utility function)
 * @param {DomainError|TransportError} error - Error object
 * @param {string} code - Error code to check
 * @returns {boolean}
 */
export function isErrorCode(error, code) {
  return error?.code === code;
}
