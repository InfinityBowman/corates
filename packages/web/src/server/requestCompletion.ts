import { info } from '@corates/workers/logger';

/** Paths excluded from request.completed — batched telemetry, not user-facing latency. */
const SKIP_PATHS = new Set(['/api/client-logs']);

export function shouldLogRequestCompletion(pathname: string): boolean {
  return !SKIP_PATHS.has(pathname);
}

export function logRequestCompleted(status: number, durationMs: number): void {
  info('request.completed', { status, durationMs });
}

export async function withRequestCompletionLog(
  pathname: string,
  handler: () => Promise<Response>,
): Promise<Response> {
  if (!shouldLogRequestCompletion(pathname)) {
    return handler();
  }

  const start = Date.now();
  try {
    const response = await handler();
    logRequestCompleted(response.status, Date.now() - start);
    return response;
  } catch (error) {
    logRequestCompleted(500, Date.now() - start);
    throw error;
  }
}
