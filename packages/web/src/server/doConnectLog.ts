import { warn } from '@corates/workers/logger';

/**
 * Durable Object hand-offs fail on Cloudflare platform errors ("Network
 * connection lost", object reset) whose own exception log carries neither our
 * requestId nor the project, so record which object failed before rethrowing.
 */
export async function withDoConnectLog<T extends Response | null>(
  target: Record<string, string>,
  forward: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const response = await forward();
    if (response && response.status >= 500) {
      warn('do.connect_failed', {
        ...target,
        status: response.status,
        durationMs: Date.now() - start,
      });
    }
    return response;
  } catch (error) {
    warn('do.connect_failed', {
      ...target,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - start,
    });
    throw error;
  }
}
