import { isRedirect, isNotFound } from '@tanstack/react-router';
import { isDomainError } from '@corates/shared';
import { captureError, info } from '@corates/workers/logger';

/**
 * Server functions return thrown errors to the client as data, so the request
 * itself logs a 200 under a hashed route. This records why the function failed.
 */
export function logServerFnFailure(error: unknown): void {
  if (isRedirect(error) || isNotFound(error)) return;
  if (isDomainError(error) && error.statusCode < 500) {
    info('serverfn.failed', {
      code: error.code,
      status: error.statusCode,
      details: error.details,
    });
    return;
  }
  captureError(error, { tags: { component: 'serverfn' } });
}
