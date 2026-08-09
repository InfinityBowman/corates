import { captureException } from '@/config/sentry';

export function bestEffort<T>(
  promise: Promise<T>,
  context: { operation?: string; [key: string]: unknown } = {},
): Promise<T | undefined> {
  return promise.catch(error => {
    console.warn(`Best-effort operation failed: ${context.operation || 'unknown'}`, error);
    captureException(error, { action: context.operation ?? 'bestEffort', ...context });
    return undefined;
  });
}
