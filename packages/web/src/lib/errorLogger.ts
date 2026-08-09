import { captureException } from '@/config/sentry';

export function bestEffort<T>(
  promise: Promise<T>,
  // `capture` opts a call site into Sentry. Off by default: most best-effort
  // work is an IndexedDB cache write, which fails routinely under Safari
  // private browsing and quota pressure, and reporting those would bury the
  // real ones. Set it where the failure leaves state behind - a rollback that
  // did not run orphans an R2 object. See guides/observability.md.
  context: { operation?: string; capture?: boolean; [key: string]: unknown } = {},
): Promise<T | undefined> {
  return promise.catch(error => {
    const { capture, ...details } = context;
    console.warn(`Best-effort operation failed: ${context.operation || 'unknown'}`, error);
    if (capture) {
      captureException(error, { action: context.operation ?? 'bestEffort', ...details });
    }
    return undefined;
  });
}
