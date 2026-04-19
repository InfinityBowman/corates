import { createMiddleware } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { createWorkersLogger, ensureWorkersLog } from '@corates/workers/logger';
import type { RequestLogger } from '@corates/workers/logger';

export type { RequestLogger };

export const logMiddleware = createMiddleware().server(async ({ next, request }) => {
  ensureWorkersLog({
    service: 'web',
    environment: (env as { ENVIRONMENT?: string }).ENVIRONMENT,
  });
  const log = createWorkersLogger(request);
  try {
    const result = await next({ context: { log } });
    log.emit();
    return result;
  } catch (err) {
    log.error(err as Error);
    log.emit({ status: 500, reason: 'unhandled_exception' });
    throw err;
  }
});
