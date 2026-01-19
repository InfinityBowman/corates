/**
 * Generic retry utility with exponential backoff and structured logging
 *
 * Use this utility to wrap operations that may fail transiently (network errors,
 * temporary unavailability, etc.) and should be retried automatically.
 */

import type { Logger } from './observability/logger';

export interface RetryOptions<T> {
  /** The async operation to retry */
  operation: () => Promise<T>;
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds before first retry (default: 100) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds between retries (default: 5000) */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Custom predicate to determine if error is retryable (default: always retry) */
  shouldRetry?: (_error: unknown, _attempt: number) => boolean;
  /** Logger for structured logging of retry attempts */
  logger?: Logger;
  /** Name of operation for logging (default: 'operation') */
  operationName?: string;
}

export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** The returned value on success */
  value?: T;
  /** The final error if all attempts failed */
  error?: unknown;
  /** Number of attempts made */
  attempts: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_INITIAL_DELAY_MS = 100;
const DEFAULT_MAX_DELAY_MS = 5000;
const DEFAULT_BACKOFF_MULTIPLIER = 2;

/**
 * Executes an async operation with automatic retry on failure
 *
 * @example
 * ```typescript
 * const result = await withRetry({
 *   operation: () => fetchExternalApi(),
 *   maxAttempts: 3,
 *   initialDelayMs: 100,
 *   logger,
 *   operationName: 'fetch-api',
 * });
 *
 * if (!result.success) {
 *   console.error('Operation failed after retries', result.error);
 * }
 * ```
 */
export async function withRetry<T>(options: RetryOptions<T>): Promise<RetryResult<T>> {
  const {
    operation,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    backoffMultiplier = DEFAULT_BACKOFF_MULTIPLIER,
    shouldRetry = defaultShouldRetry,
    logger,
    operationName = 'operation',
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const value = await operation();

      // Log success after retries (not on first attempt)
      if (attempt > 1 && logger) {
        logger.info(`${operationName} succeeded after retries`, {
          attempt,
          totalAttempts: attempt,
        });
      }

      return { success: true, value, attempts: attempt };
    } catch (error) {
      lastError = error;

      const errorMessage = error instanceof Error ? error.message : String(error);
      const willRetry = attempt < maxAttempts && shouldRetry(error, attempt);

      if (!willRetry) {
        // Final failure - log at error level
        if (logger) {
          logger.error(`${operationName} failed after ${attempt} attempt(s)`, {
            attempts: attempt,
            maxAttempts,
            error: errorMessage,
            willRetry: false,
          });
        }
        return { success: false, error: lastError, attempts: attempt };
      }

      // Calculate delay with exponential backoff and jitter
      const delayMs = calculateDelay(attempt, {
        initialDelayMs,
        maxDelayMs,
        backoffMultiplier,
      });

      // Log retry attempt at warn level
      if (logger) {
        logger.warn(`${operationName} failed, retrying`, {
          attempt,
          maxAttempts,
          nextDelayMs: delayMs,
          error: errorMessage,
        });
      }

      await sleep(delayMs);
    }
  }

  // Should never reach here, but TypeScript needs it
  return { success: false, error: lastError, attempts: maxAttempts };
}

/**
 * Calculate delay with exponential backoff and jitter
 * Jitter helps prevent thundering herd when multiple operations fail simultaneously
 */
function calculateDelay(
  attempt: number,
  config: {
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  },
): number {
  // Exponential backoff: delay = initial * multiplier^(attempt-1)
  const exponential = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
    config.maxDelayMs,
  );

  // Add 0-20% jitter to prevent thundering herd
  const jitter = exponential * 0.2 * Math.random();

  return Math.round(exponential + jitter);
}

/**
 * Default retry predicate - always retry unless we've exhausted attempts
 */
function defaultShouldRetry(_error: unknown, _attempt: number): boolean {
  return true;
}

/**
 * Simple sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
