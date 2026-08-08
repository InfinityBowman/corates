import type { Context } from 'hono';
import type { Env } from '../../types';
import { truncateError } from '@corates/shared/crypto';
import {
  createLogger as createCoreLogger,
  type Logger as CoreLogger,
  type LogEntry,
} from '@corates/shared/logger';

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

  if (c?.header) {
    c.header('X-Request-Id', requestId);
  }

  const core = createCoreLogger({
    service,
    env: env?.ENVIRONMENT || 'development',
    requestId,
    cfRay,
    context: c?.req ? { route: c.req.path, method: c.req.method } : undefined,
  });

  return wrap(core, requestId, cfRay);
}

function wrap(core: CoreLogger, requestId: string, cfRay: string | null): Logger {
  return {
    requestId,
    cfRay,
    debug: core.debug,
    info: core.info,
    warn: core.warn,
    error: core.error,

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

      const isFailure = data.outcome === 'failed' || data.errorCode;
      return isFailure ?
          core.error(`stripe.${action}`, stripeData)
        : core.info(`stripe.${action}`, stripeData);
    },

    child(context: Record<string, unknown>): Logger {
      return wrap(core.child(context), requestId, cfRay);
    },
  };
}

function getOrCreateRequestId(c?: Context): string {
  const existingId = c?.req?.header('x-request-id');
  if (existingId) {
    return existingId;
  }

  return crypto.randomUUID();
}

export { withTiming } from '@corates/shared/logger';
