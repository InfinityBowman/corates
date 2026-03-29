/**
 * Error Logger - Centralized error logging for monitoring integration
 *
 * Provides a single point of integration for error monitoring services (Sentry, LogRocket, etc.)
 * All error logging should go through this module to ensure consistent handling and easy
 * integration with monitoring services in the future.
 *
 * Usage:
 *   import { logError, logWarning, bestEffort } from '@/lib/errorLogger.js';
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
import { captureException, captureMessage, isSentryEnabled } from '@/config/sentry.js';

/**
 * Log levels for categorizing messages
 */
const LogLevel = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;

type LogLevelValue = (typeof LogLevel)[keyof typeof LogLevel];

interface ErrorData {
  code: string;
  message: string;
  statusCode?: number;
  details?: unknown;
  stack?: string;
}

interface LogContext {
  component?: string;
  action?: string;
  metadata?: Record<string, unknown>;
  error?: ErrorData;
  originalError?: Error;
  operation?: string;
  [key: string]: unknown;
}

/**
 * Format error data for logging
 * Normalizes different error formats into a consistent structure
 */
function formatErrorData(error: unknown): ErrorData {
  const normalized = normalizeError(error);
  return {
    code: normalized.code || 'UNKNOWN',
    message: normalized.message || String(error),
    statusCode:
      'statusCode' in normalized ? (normalized.statusCode as number | undefined) : undefined,
    details: normalized.details,
    stack: error instanceof Error ? error.stack : undefined,
  };
}

/**
 * Core logging function
 * Handles both console output and Sentry error monitoring
 */
function log(level: LogLevelValue, message: string, context: LogContext = {}): void {
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
 */
export function logError(error: unknown, context: LogContext = {}): void {
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
 */
export function logWarning(message: string, context: LogContext = {}): void {
  log(LogLevel.WARNING, message, context);
}

/**
 * Log informational messages
 * Use sparingly - mainly for important state transitions
 */
export function logInfo(message: string, context: LogContext = {}): void {
  log(LogLevel.INFO, message, context);
}

/**
 * Wrap a best-effort operation that can fail silently
 * Logs warnings on failure but doesn't throw
 *
 * Use for cleanup operations, cache updates, and other non-critical tasks
 * where failure shouldn't break the user experience.
 */
export function bestEffort<T>(
  promise: Promise<T>,
  context: LogContext = {},
): Promise<T | undefined> {
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
 */
export function withErrorLogging(
  component: string,
  action: string,
): <T>(fn: () => Promise<T>) => Promise<T> {
  return async <T>(fn: () => Promise<T>): Promise<T> => {
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
 */
export function logAndRethrow(
  component: string,
  action: string,
  metadata: Record<string, unknown> = {},
): (error: unknown) => never {
  return (error: unknown): never => {
    logError(error, { component, action, ...metadata });
    throw error;
  };
}
