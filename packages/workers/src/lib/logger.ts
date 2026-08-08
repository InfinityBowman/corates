import * as Sentry from '@sentry/cloudflare';
import { createLogger } from '@corates/shared/logger';

type LogParams = (string | number)[] | Record<string, unknown>;

interface ErrorContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

const log = createLogger({ service: 'corates-workers' });

export function captureError(error: unknown, context?: ErrorContext): void {
  const err = error instanceof Error ? error : undefined;
  log.error(err?.message ?? String(error), {
    ...(err?.name && err.name !== 'Error' && { errorName: err.name }),
    ...(err?.stack && { stack: err.stack }),
    ...context?.tags,
    ...context?.extra,
  });
  Sentry.captureException(error, context);
}

export function warn(message: string, params?: LogParams): void {
  const [msg, data] = normalize(message, params);
  log.warn(msg, data);
  Sentry.logger.warn(message, toAttributes(params));
}

export function info(message: string, params?: LogParams): void {
  const [msg, data] = normalize(message, params);
  log.info(msg, data);
  Sentry.logger.info(message, toAttributes(params));
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

function toAttributes(params?: LogParams): Record<string, unknown> | undefined {
  if (!params) return undefined;
  if (!Array.isArray(params)) return params;
  const attrs: Record<string, unknown> = {};
  for (let i = 0; i < params.length; i++) {
    attrs[`param.${i}`] = params[i];
  }
  return attrs;
}
