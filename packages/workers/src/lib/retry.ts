import { captureError, warn, info } from './logger';

interface RetryOptions<T> {
  operation: () => Promise<T>;
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (_error: unknown, _attempt: number) => boolean;
  /** Logger context fields included on every log line (e.g. projectId, userId). */
  logContext?: Record<string, unknown>;
  operationName?: string;
}

interface RetryResult<T> {
  success: boolean;
  value?: T;
  error?: unknown;
  attempts: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_INITIAL_DELAY_MS = 100;
const DEFAULT_MAX_DELAY_MS = 5000;
const DEFAULT_BACKOFF_MULTIPLIER = 2;

export async function withRetry<T>(options: RetryOptions<T>): Promise<RetryResult<T>> {
  const {
    operation,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    backoffMultiplier = DEFAULT_BACKOFF_MULTIPLIER,
    shouldRetry = defaultShouldRetry,
    logContext,
    operationName = 'operation',
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const value = await operation();

      if (attempt > 1) {
        info(`[retry] ${operationName} succeeded after ${attempt} attempts`);
      }

      return { success: true, value, attempts: attempt };
    } catch (error) {
      lastError = error;

      const willRetry = attempt < maxAttempts && shouldRetry(error, attempt);

      if (!willRetry) {
        captureError(error, {
          tags: { component: 'retry', operation: operationName },
          extra: { ...logContext, attempts: attempt, maxAttempts },
        });
        return { success: false, error: lastError, attempts: attempt };
      }

      const delayMs = calculateDelay(attempt, {
        initialDelayMs,
        maxDelayMs,
        backoffMultiplier,
      });

      warn(`[retry] ${operationName} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms`);

      await sleep(delayMs);
    }
  }

  return { success: false, error: lastError, attempts: maxAttempts };
}

function calculateDelay(
  attempt: number,
  config: { initialDelayMs: number; maxDelayMs: number; backoffMultiplier: number },
): number {
  const exponential = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
    config.maxDelayMs,
  );

  // 0-20% jitter prevents thundering herd when many ops fail at once
  const jitter = exponential * 0.2 * Math.random();
  return Math.round(exponential + jitter);
}

function defaultShouldRetry(_error: unknown, _attempt: number): boolean {
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
