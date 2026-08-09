/**
 * Server-side logging for the workers package.
 *
 * Logs are Loki-first: every entry is structured JSON on the console, which
 * Cloudflare Workers Observability exports over OTLP (see infra/observability).
 * Sentry is reserved for exceptions, where the stack trace and release mapping
 * earn their keep — informational logs are not mirrored there.
 *
 * Request correlation rides on AsyncLocalStorage rather than a threaded
 * parameter, so command signatures stay `(env, actor, params)` while their
 * logs still carry requestId/cfRay. Entry points call `runWithLogger`.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import * as Sentry from '@sentry/cloudflare';
import { createLogger, type Logger } from '@corates/shared/logger';

type LogParams = (string | number)[] | Record<string, unknown>;

interface ErrorContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export interface RequestScope {
  requestId?: string;
  cfRay?: string | null;
  env?: string;
  /** Static fields merged into every entry in this scope (e.g. route, method) */
  context?: Record<string, unknown>;
}

const SERVICE = 'corates-workers';

const scopeStore = new AsyncLocalStorage<Logger>();

// Used by module-init code, tests, and anything running outside a request.
const unscoped = createLogger({ service: SERVICE });

function current(): Logger {
  return scopeStore.getStore() ?? unscoped;
}

/** Establish a request-scoped logger. Entry points wrap their handler in this. */
export function runWithLogger<T>({ requestId, cfRay, env, context }: RequestScope, fn: () => T): T {
  return scopeStore.run(createLogger({ service: SERVICE, requestId, cfRay, env, context }), fn);
}

/** Merge fields into the ambient logger for the remainder of the current scope. */
export function runWithContext<T>(context: Record<string, unknown>, fn: () => T): T {
  return scopeStore.run(current().child(context), fn);
}

/** The active request's id, for echoing back as a response header. */
export function getRequestId(): string | undefined {
  return current().requestId;
}

export function captureError(error: unknown, context?: ErrorContext): void {
  const err = error instanceof Error ? error : undefined;
  current().error(err?.message ?? String(error), {
    ...(err?.name && err.name !== 'Error' && { errorName: err.name }),
    ...(err?.stack && { stack: err.stack }),
    ...context?.tags,
    ...context?.extra,
  });
  Sentry.captureException(error, context);
}

export function debug(message: string, params?: LogParams): void {
  const [msg, data] = normalize(message, params);
  current().debug(msg, data);
}

export function info(message: string, params?: LogParams): void {
  const [msg, data] = normalize(message, params);
  current().info(msg, data);
}

export function warn(message: string, params?: LogParams): void {
  const [msg, data] = normalize(message, params);
  current().warn(msg, data);
}

// Array params come from printf-style call sites (`info('org %s', [orgId])`);
// interpolate them so the JSON message reads naturally in log queries.
function normalize(
  message: string,
  params?: LogParams,
): [string, Record<string, unknown> | undefined] {
  if (!params) return [message, undefined];
  if (!Array.isArray(params)) return [message, params];
  let i = 0;
  const msg = message.replace(/%s/g, () => (i < params.length ? String(params[i++]) : '%s'));
  const rest = params.slice(i);
  return [msg, rest.length > 0 ? { params: rest } : undefined];
}
