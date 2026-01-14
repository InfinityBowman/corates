import type { Context } from 'hono';
import type { Env } from '../../types';

export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const;

type LogLevelType = (typeof LogLevel)[keyof typeof LogLevel];

interface LogEntry {
  ts: string;
  level: LogLevelType;
  service: string;
  env: string;
  requestId: string;
  cfRay: string | null;
  message: string;
  route?: string;
  method?: string;
  [key: string]: unknown;
}

interface StripeLogData {
  stripeEventId?: string;
  stripeEventType?: string;
  stripeMode?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeCheckoutSessionId?: string;
  stripeRequestId?: string;
  orgId?: string;
  userId?: string;
  plan?: string;
  outcome?: string;
  errorCode?: string;
  status?: string;
  durationMs?: number;
  error?: Error | string | object;
  payloadHash?: string;
  signaturePresent?: boolean;
}

export interface Logger {
  requestId: string;
  cfRay: string | null;
  debug: (_message: string, _data?: Record<string, unknown>) => LogEntry;
  info: (_message: string, _data?: Record<string, unknown>) => LogEntry;
  warn: (_message: string, _data?: Record<string, unknown>) => LogEntry;
  error: (_message: string, _data?: Record<string, unknown>) => LogEntry;
  stripe: (_action: string, _data?: StripeLogData) => LogEntry;
  child: (_context: Record<string, unknown>) => Logger;
}

interface LoggerOptions {
  c?: Context;
  service: string;
  env?: Env;
}

export function createLogger({ c, service, env }: LoggerOptions): Logger {
  const requestId = getOrCreateRequestId(c);
  const cfRay = c?.req?.header('cf-ray') || null;
  const environment = env?.ENVIRONMENT || 'development';

  if (c?.header) {
    c.header('X-Request-Id', requestId);
  }

  function buildLogEntry(
    level: LogLevelType,
    message: string,
    data: Record<string, unknown> = {},
  ): LogEntry {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      service,
      env: environment,
      requestId,
      cfRay,
      message,
      ...data,
    };

    if (c?.req) {
      entry.route = c.req.path;
      entry.method = c.req.method;
    }

    return entry;
  }

  function output(level: LogLevelType, entry: LogEntry): void {
    const json = JSON.stringify(entry);
    switch (level) {
      case LogLevel.ERROR:
        console.error(json);
        break;
      case LogLevel.WARN:
        console.warn(json);
        break;
      case LogLevel.DEBUG:
        console.debug(json);
        break;
      default:
        console.log(json);
    }
  }

  const logger: Logger = {
    requestId,
    cfRay,

    debug(message: string, data?: Record<string, unknown>): LogEntry {
      const entry = buildLogEntry(LogLevel.DEBUG, message, data);
      output(LogLevel.DEBUG, entry);
      return entry;
    },

    info(message: string, data?: Record<string, unknown>): LogEntry {
      const entry = buildLogEntry(LogLevel.INFO, message, data);
      output(LogLevel.INFO, entry);
      return entry;
    },

    warn(message: string, data?: Record<string, unknown>): LogEntry {
      const entry = buildLogEntry(LogLevel.WARN, message, data);
      output(LogLevel.WARN, entry);
      return entry;
    },

    error(message: string, data?: Record<string, unknown>): LogEntry {
      const entry = buildLogEntry(LogLevel.ERROR, message, data);
      output(LogLevel.ERROR, entry);
      return entry;
    },

    stripe(action: string, data: StripeLogData = {}): LogEntry {
      const stripeData: Record<string, unknown> = {
        action,
        ...(data.stripeEventId && { stripeEventId: data.stripeEventId }),
        ...(data.stripeEventType && { stripeEventType: data.stripeEventType }),
        ...(data.stripeMode && { stripeMode: data.stripeMode }),
        ...(data.stripeCustomerId && { stripeCustomerId: data.stripeCustomerId }),
        ...(data.stripeSubscriptionId && { stripeSubscriptionId: data.stripeSubscriptionId }),
        ...(data.stripeCheckoutSessionId && {
          stripeCheckoutSessionId: data.stripeCheckoutSessionId,
        }),
        ...(data.stripeRequestId && { stripeRequestId: data.stripeRequestId }),
        ...(data.orgId && { orgId: data.orgId }),
        ...(data.userId && { userId: data.userId }),
        ...(data.plan && { plan: data.plan }),
        ...(data.outcome && { outcome: data.outcome }),
        ...(data.errorCode && { errorCode: data.errorCode }),
        ...(data.status && { status: data.status }),
        ...(data.durationMs !== undefined && { durationMs: data.durationMs }),
        ...(data.error && { error: truncateError(data.error) }),
        ...(data.payloadHash && { payloadHash: data.payloadHash }),
        ...(data.signaturePresent !== undefined && { signaturePresent: data.signaturePresent }),
      };

      const level = data.outcome === 'failed' || data.errorCode ? LogLevel.ERROR : LogLevel.INFO;
      const entry = buildLogEntry(level, `stripe.${action}`, stripeData);
      output(level, entry);
      return entry;
    },

    child(context: Record<string, unknown>): Logger {
      const parent = this;
      return {
        requestId,
        cfRay,
        debug(message: string, data?: Record<string, unknown>): LogEntry {
          return parent.debug(message, { ...context, ...data });
        },
        info(message: string, data?: Record<string, unknown>): LogEntry {
          return parent.info(message, { ...context, ...data });
        },
        warn(message: string, data?: Record<string, unknown>): LogEntry {
          return parent.warn(message, { ...context, ...data });
        },
        error(message: string, data?: Record<string, unknown>): LogEntry {
          return parent.error(message, { ...context, ...data });
        },
        stripe(action: string, data?: StripeLogData): LogEntry {
          return parent.stripe(action, { ...context, ...data } as StripeLogData);
        },
        child(additionalContext: Record<string, unknown>): Logger {
          return parent.child({ ...context, ...additionalContext });
        },
      };
    },
  };

  return logger;
}

export function getOrCreateRequestId(c?: Context): string {
  const existingId = c?.req?.header('x-request-id');
  if (existingId) {
    return existingId;
  }

  return crypto.randomUUID();
}

export function truncateError(
  error: Error | string | object | null | undefined,
  maxLength: number = 500,
): string | null {
  if (!error) return null;

  let errorStr: string;
  if (error instanceof Error) {
    errorStr = error.message;
  } else if (typeof error === 'string') {
    errorStr = error;
  } else {
    try {
      errorStr = JSON.stringify(error);
    } catch {
      errorStr = String(error);
    }
  }

  if (errorStr.length > maxLength) {
    return errorStr.slice(0, maxLength) + '...[truncated]';
  }
  return errorStr;
}

export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface TimingResult<T> {
  result: T;
  durationMs: number;
}

export async function withTiming<T>(fn: () => Promise<T>): Promise<TimingResult<T>> {
  const start = Date.now();
  try {
    const result = await fn();
    return { result, durationMs: Date.now() - start };
  } catch (error) {
    (error as Error & { durationMs: number }).durationMs = Date.now() - start;
    throw error;
  }
}
