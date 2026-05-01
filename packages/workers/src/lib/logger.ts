import * as Sentry from '@sentry/cloudflare';

type LogParams = (string | number)[] | Record<string, unknown>;

interface ErrorContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export function captureError(error: unknown, context?: ErrorContext): void {
  console.error(error);
  Sentry.captureException(error, context);
}

export function warn(message: string, params?: LogParams): void {
  console.warn(
    message,
    ...(Array.isArray(params) ? params
    : params ? [params]
    : []),
  );
  Sentry.logger.warn(message, toAttributes(params));
}

export function info(message: string, params?: LogParams): void {
  console.info(
    message,
    ...(Array.isArray(params) ? params
    : params ? [params]
    : []),
  );
  Sentry.logger.info(message, toAttributes(params));
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
