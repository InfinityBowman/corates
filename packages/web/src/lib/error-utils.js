/**
 * Error parsing and handling utilities
 * Provides centralized error handling for API responses and client-side errors
 */

import { ERROR_CODES, mapBackendCodeToFrontend, getErrorMessage } from '@/constants/errors.js';
import { showToast } from '@corates/ui';

/**
 * Parse an API error response from fetch
 * Handles both backend error codes and Better Auth error formats
 * @param {Response} response - Fetch response object
 * @returns {Promise<{code: string, message: string, details?: any}>}
 */
export async function parseApiError(response) {
  try {
    const data = await response.json().catch(() => ({}));

    // Check for backend error code format: { error: string, code: number }
    if (data.code && typeof data.code === 'number') {
      const frontendCode = mapBackendCodeToFrontend(data.code);
      if (frontendCode) {
        return {
          code: frontendCode,
          message: data.error || getErrorMessage(frontendCode),
          details: data.details || null,
        };
      }
    }

    // Check for frontend error code format: { error: string, code: string }
    if (data.code && typeof data.code === 'string' && ERROR_CODES[data.code]) {
      return {
        code: data.code,
        message: data.error || getErrorMessage(data.code),
        details: data.details || null,
      };
    }

    // Fallback to error message if available
    if (data.error) {
      return {
        code: 'UNKNOWN_ERROR',
        message: data.error,
        details: data.details || null,
      };
    }

    // Handle HTTP status codes
    const statusCode = response.status;
    if (statusCode === 401) {
      return {
        code: 'AUTH_REQUIRED',
        message: getErrorMessage('AUTH_REQUIRED'),
      };
    }
    if (statusCode === 403) {
      return {
        code: 'AUTH_FORBIDDEN',
        message: getErrorMessage('AUTH_FORBIDDEN'),
      };
    }
    if (statusCode === 404) {
      return {
        code: 'NOT_FOUND',
        message: getErrorMessage('NOT_FOUND'),
      };
    }
    if (statusCode === 429) {
      return {
        code: 'RATE_LIMITED',
        message: getErrorMessage('RATE_LIMITED'),
      };
    }
    if (statusCode >= 500) {
      return {
        code: 'INTERNAL_ERROR',
        message: getErrorMessage('INTERNAL_ERROR'),
      };
    }

    // Default unknown error
    return {
      code: 'UNKNOWN_ERROR',
      message: `Request failed with status ${statusCode}`,
    };
  } catch (_err) {
    // If we can't parse the response, return a generic error
    return {
      code: 'UNKNOWN_ERROR',
      message: getErrorMessage('UNKNOWN_ERROR'),
    };
  }
}

/**
 * Error pattern matchers - use regex for more precise matching
 * Patterns are checked in order of specificity (most specific first)
 */
const ERROR_PATTERNS = [
  // Network errors - check for specific network-related phrases
  {
    pattern: /\b(failed to fetch|load failed|network error|connection error|cors error)\b/i,
    code: 'NETWORK_ERROR',
  },
  // Timeout errors
  {
    pattern: /\b(timeout|timed out|request timeout)\b/i,
    code: 'TIMEOUT_ERROR',
  },
  // Authentication errors - check for credential-related phrases
  {
    pattern: /\b(invalid credentials?|incorrect (email|password)|wrong (email|password))\b/i,
    code: 'INVALID_CREDENTIALS',
  },
  // User not found - check for user-related phrases
  {
    pattern: /\b(user|account) (not found|does not exist|doesn't exist|not exist)\b/i,
    code: 'USER_NOT_FOUND',
  },
  // Email verification errors
  {
    pattern: /\b(email (not )?verified|email_verified_at is null)\b/i,
    code: 'EMAIL_NOT_VERIFIED',
  },
  // Rate limiting
  {
    pattern: /\b(too many requests|rate limit(ed)?|rate-limit)\b/i,
    code: 'RATE_LIMITED',
  },
];

/**
 * Parse error from an Error object or string
 * Handles Better Auth errors, network errors, and generic errors
 * Uses pattern matching for more robust error detection
 * @param {Error|string|any} error - Error object, string, or other error format
 * @returns {{code: string, message: string}}
 */
export function parseError(error) {
  // Handle structured error objects first (Better Auth format)
  if (error && typeof error === 'object' && !(error instanceof Error)) {
    // Better Auth error format: { error: { status: number, message: string } }
    if (error.error && typeof error.error === 'object') {
      if (error.error.status === 429) {
        return {
          code: 'RATE_LIMITED',
          message: getErrorMessage('RATE_LIMITED'),
        };
      }
      if (error.error.status === 401) {
        return {
          code: 'AUTH_REQUIRED',
          message: getErrorMessage('AUTH_REQUIRED'),
        };
      }
      if (error.error.message) {
        return parseError(error.error.message);
      }
    }
  }

  // Handle Error objects and strings
  let errorMessage = '';
  if (error instanceof Error) {
    errorMessage = error.message || '';
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object' && error.message) {
    errorMessage = error.message;
  }

  // Normalize message for pattern matching
  const normalizedMessage = errorMessage.toLowerCase().trim();

  // Try pattern matching (most specific patterns first)
  for (const { pattern, code } of ERROR_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      return {
        code,
        message: getErrorMessage(code),
      };
    }
  }

  // Fallback: if we have an error message, use it
  if (errorMessage) {
    return {
      code: 'UNKNOWN_ERROR',
      message: errorMessage,
    };
  }

  // Default unknown error
  return {
    code: 'UNKNOWN_ERROR',
    message: getErrorMessage('UNKNOWN_ERROR'),
  };
}

/**
 * Unified error handling with optional toast notification and state update
 * @param {Error|Response|string|{code: string, message: string}|any} error - Error to handle, or pre-parsed error object
 * @param {Object} options - Handling options
 * @param {Function} [options.setError] - State setter function for inline errors
 * @param {boolean} [options.showToast=true] - Whether to show toast notification
 * @param {string} [options.toastTitle] - Custom toast title (defaults to error message)
 * @param {Function} [options.onError] - Callback function with parsed error
 * @param {Function} [options.navigate] - Navigation function for redirects
 * @returns {Promise<{code: string, message: string}>} Parsed error object
 */
export async function handleError(error, options = {}) {
  const { setError, showToast: showToastOption = true, toastTitle, onError, navigate } = options;

  let parsedError;

  // If error is already a parsed error object (has code and message), use it directly
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    parsedError = error;
  }
  // Handle Response objects (from fetch)
  else if (error instanceof Response) {
    parsedError = await parseApiError(error);
  } else {
    parsedError = parseError(error);
  }

  // Call custom error handler if provided
  if (onError) {
    onError(parsedError);
  }

  // Handle special cases that require navigation
  if (navigate) {
    if (parsedError.code === 'EMAIL_NOT_VERIFIED') {
      navigate('/verify-email', { replace: true });
      return parsedError;
    }
  }

  // Update error state if setter provided
  if (setError) {
    setError(parsedError.message);
  }

  // Show toast notification if enabled
  if (showToastOption) {
    const title = toastTitle || parsedError.message;
    showToast.error(title, parsedError.details || '');
  }

  return parsedError;
}

/**
 * Handle fetch errors with automatic error parsing
 * Wraps fetch calls to automatically parse and handle errors
 * @param {Promise<Response>} fetchPromise - Promise from fetch call
 * @param {Object} options - Error handling options (same as handleError)
 * @returns {Promise<Response>} Response if successful, throws parsed error otherwise
 */
export async function handleFetchError(fetchPromise, options = {}) {
  try {
    const response = await fetchPromise;

    if (!response.ok) {
      // Parse the response once
      const parsedError = await parseApiError(response);
      // Pass the parsed error object to handleError to avoid double parsing
      await handleError(parsedError, options);
      throw new Error(parsedError.message);
    }

    return response;
  } catch (error) {
    // If it's already a parsed error object, use it directly
    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      await handleError(error, options);
      throw new Error(error.message);
    }
    // Otherwise parse and handle
    const parsedError = parseError(error);
    await handleError(parsedError, options);
    throw new Error(parsedError.message);
  }
}
