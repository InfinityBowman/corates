/**
 * Error Logger - Centralized error logging for monitoring integration
 *
 * Provides a single point of integration for error monitoring services (Sentry, LogRocket, etc.)
 * All error logging should go through this module to ensure consistent handling and easy
 * integration with monitoring services in the future.
 *
 * Usage:
 *   import { logError, logWarning, bestEffort } from '@lib/errorLogger.js';
 *
 *   // Log an error with context
 *   logError(error, { component: 'ProjectView', action: 'loadProject' });
 *
 *   // Log a warning for non-fatal issues
 *   logWarning('Cache miss for user avatar', { userId: '123' });
 *
 *   // Wrap best-effort operations that can fail silently
 *   bestEffort(clearFormState(type), { operation: 'clearFormState' });
 */

import { normalizeError } from '@corates/shared';
import { captureException, captureMessage, isSentryEnabled } from '@config/sentry.js';

/**
 * Log levels for categorizing messages
 */
const LogLevel = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

/**
 * Format error data for logging
 * Normalizes different error formats into a consistent structure
 */
function formatErrorData(error) {
  const normalized = normalizeError(error);
  return {
    code: normalized.code || 'UNKNOWN',
    message: normalized.message || String(error),
    statusCode: normalized.statusCode,
    details: normalized.details,
    stack: error?.stack,
  };
}

/**
 * Core logging function
 * Handles both console output and Sentry error monitoring
 */
function log(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  const logData = {
    level,
    message,
    timestamp,
    ...context,
  };

  // Console output with appropriate method
  switch (level) {
    case LogLevel.ERROR:
      console.error(`[Error] ${message}`, logData);
      break;
    case LogLevel.WARNING:
      console.warn(`[Warning] ${message}`, logData);
      break;
    default:
      console.info(`[Info] ${message}`, logData);
  }

  // Send to Sentry if enabled
  if (isSentryEnabled()) {
    if (level === LogLevel.ERROR && context.error) {
      // For errors, capture the original error object if available
      const originalError = context.originalError || new Error(message);
      captureException(originalError, context);
    } else if (level === LogLevel.ERROR || level === LogLevel.WARNING) {
      // For warnings and errors without an error object, capture as message
      captureMessage(message, level, context);
    }
    // INFO level messages are not sent to Sentry to reduce noise
  }
}

/**
 * Log an error with context
 * Use this for caught exceptions and error boundary errors
 *
 * @param {Error|DomainError|TransportError|unknown} error - The error to log
 * @param {Object} context - Additional context for debugging
 * @param {string} [context.component] - Component where error occurred
 * @param {string} [context.action] - Action that triggered the error
 * @param {Object} [context.metadata] - Additional metadata
 */
export function logError(error, context = {}) {
  const errorData = formatErrorData(error);
  const message = context.action ? `${context.action}: ${errorData.message}` : errorData.message;

  log(LogLevel.ERROR, message, {
    ...context,
    error: errorData,
    // Pass original error for Sentry stack trace
    originalError: error instanceof Error ? error : new Error(errorData.message),
  });
}

/**
 * Log a warning for non-fatal issues
 * Use this for degraded functionality, cache misses, etc.
 *
 * @param {string} message - Warning message
 * @param {Object} context - Additional context for debugging
 */
export function logWarning(message, context = {}) {
  log(LogLevel.WARNING, message, context);
}

/**
 * Log informational messages
 * Use sparingly - mainly for important state transitions
 *
 * @param {string} message - Info message
 * @param {Object} context - Additional context
 */
export function logInfo(message, context = {}) {
  log(LogLevel.INFO, message, context);
}

/**
 * Wrap a best-effort operation that can fail silently
 * Logs warnings on failure but doesn't throw
 *
 * Use for cleanup operations, cache updates, and other non-critical tasks
 * where failure shouldn't break the user experience.
 *
 * @param {Promise} promise - The operation to run
 * @param {Object} context - Context for logging if operation fails
 * @returns {Promise} Resolves to the result or undefined on failure
 *
 * @example
 * // Instead of: clearFormState(type).catch(() => {});
 * bestEffort(clearFormState(type), { operation: 'clearFormState', type });
 */
export function bestEffort(promise, context = {}) {
  return promise.catch(error => {
    logWarning(`Best-effort operation failed: ${context.operation || 'unknown'}`, {
      ...context,
      error: formatErrorData(error),
    });
    return undefined;
  });
}

/**
 * Create a logging wrapper for async functions
 * Catches errors, logs them, and rethrows
 *
 * @param {string} component - Component name for context
 * @param {string} action - Action name for context
 * @returns {Function} Wrapper function that logs and rethrows errors
 *
 * @example
 * async function loadProject(id) {
 *   return withErrorLogging('ProjectView', 'loadProject')(async () => {
 *     const data = await apiFetch(`/api/projects/${id}`);
 *     return data;
 *   });
 * }
 */
export function withErrorLogging(component, action) {
  return async fn => {
    try {
      return await fn();
    } catch (error) {
      logError(error, { component, action });
      throw error;
    }
  };
}

/**
 * Log error and rethrow - for catch blocks that need to log but propagate
 *
 * @param {string} component - Component name for context
 * @param {string} action - Action name for context
 * @param {Object} metadata - Additional metadata
 * @returns {Function} Error handler that logs and rethrows
 *
 * @example
 * fetchData().catch(logAndRethrow('ProjectView', 'fetchData'));
 */
export function logAndRethrow(component, action, metadata = {}) {
  return error => {
    logError(error, { component, action, ...metadata });
    throw error;
  };
}
