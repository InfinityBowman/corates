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
} from '@corates/shared'
import { showToast } from '@corates/ui'

/**
 * Parse API error response - only returns DomainError
 * API responses only return domain errors, never transport errors
 * @param {Response} response - Fetch response object
 * @returns {Promise<DomainError>}
 */
export async function parseApiError(response) {
  try {
    const data = await response.json()
    // Validate the error response matches DomainError shape
    return validateErrorResponse(data)
  } catch (_err) {
    // If response body can't be parsed, create unknown error
    return {
      code: 'UNKNOWN_INVALID_RESPONSE',
      message: 'Invalid error response format',
      statusCode: response.status || 500,
      timestamp: new Date().toISOString(),
    }
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
    const response = await fetchPromise

    if (!response.ok) {
      // Parse domain error from API response
      const domainError = await parseApiError(response)
      await handleDomainError(domainError, options)
      throw domainError
    }

    return response
  } catch (error) {
    // If already a domain error, re-throw
    if (isDomainError(error)) {
      throw error
    }

    // Normalize the error once
    const normalizedError = normalizeError(error)

    // Branch based on error type
    if (isTransportError(normalizedError)) {
      await handleTransportError(normalizedError, options)
      throw normalizedError
    } else if (isDomainError(normalizedError)) {
      await handleDomainError(normalizedError, options)
      throw normalizedError
    } else {
      // Fallback: treat as transport error
      await handleTransportError(normalizedError, options)
      throw normalizedError
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
  const {
    setError,
    showToast: showToastOption = true,
    toastTitle,
    onError,
    navigate,
  } = options

  // Call custom error handler if provided
  if (onError) {
    onError(error)
  }

  // Handle navigation-required errors
  if (navigate) {
    if (
      error.code === AUTH_ERRORS.REQUIRED.code ||
      error.code === AUTH_ERRORS.EXPIRED.code
    ) {
      navigate({ to: '/signin', replace: true })
      return
    }
    if (error.code === USER_ERRORS.EMAIL_NOT_VERIFIED.code) {
      navigate({ to: '/verify-email', replace: true })
      return
    }
  }

  // Update error state if setter provided
  if (setError) {
    setError(error.message)
  }

  // Show toast for user-facing errors
  if (showToastOption) {
    const title = toastTitle || error.message
    showToast.error(title, error.details || '')
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
  const {
    setError,
    showToast: showToastOption = true,
    toastTitle,
    onError,
  } = options

  // Call custom error handler if provided
  if (onError) {
    onError(error)
  }

  // Update error state if setter provided
  if (setError) {
    setError(error.message)
  }

  // Show toast for transport errors
  if (showToastOption) {
    const title = toastTitle || 'Connection Error'
    showToast.error(title, error.message)
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
    await handleDomainError(error, options)
    return error
  }

  // If already a transport error, handle as transport error
  if (isTransportError(error)) {
    await handleTransportError(error, options)
    return error
  }

  // If Response object, parse as domain error
  if (error instanceof Response) {
    const domainError = await parseApiError(error)
    await handleDomainError(domainError, options)
    return domainError
  }

  // Otherwise, normalize and handle
  const normalizedError = normalizeError(error)
  if (isTransportError(normalizedError)) {
    await handleTransportError(normalizedError, options)
  } else {
    await handleDomainError(normalizedError, options)
  }

  return normalizedError
}

/**
 * Parse error from an Error object or string (backward compatibility)
 * @param {Error|string|any} error - Error object, string, or other error format
 * @returns {DomainError|TransportError} Normalized error
 */
export function parseError(error) {
  return normalizeError(error)
}

/**
 * Check if error code matches (utility function)
 * @param {DomainError|TransportError} error - Error object
 * @param {string} code - Error code to check
 * @returns {boolean}
 */
export function isErrorCode(error, code) {
  return error?.code === code
}
