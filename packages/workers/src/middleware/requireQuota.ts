import type { Context, MiddlewareHandler } from 'hono';
import { createDb } from '../db/client';
import { getAuth } from './auth';
import { getOrgContext } from './requireOrg';
import { resolveOrgAccess } from '../lib/billingResolver';
import { createDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { isUnlimitedQuota } from '@corates/shared/plans';
import { createLogger } from '../lib/observability/logger';
import type { AppContext, AuthUser, OrgBilling } from '../types';

interface Logger {
  error: (_message: string, _data?: Record<string, unknown>) => void;
  warn: (_message: string, _data?: Record<string, unknown>) => void;
  info: (_message: string, _data?: Record<string, unknown>) => void;
  debug: (_message: string, _data?: Record<string, unknown>) => void;
}

type UsageGetter = (_c: Context, _user: AuthUser) => Promise<number>;

export function requireQuota(
  quotaKey: string,
  getUsage: UsageGetter,
  requested: number = 1,
): MiddlewareHandler {
  return async (c, next) => {
    const { user } = getAuth(c);

    if (!user) {
      const error = createDomainError(AUTH_ERRORS.REQUIRED);
      return c.json(error, error.statusCode as 401);
    }

    const { orgId } = getOrgContext(c);
    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'org_context_required',
      });
      return c.json(error, error.statusCode as 403);
    }

    let orgBilling: OrgBilling;
    try {
      const db = createDb((c as AppContext).env.DB);
      orgBilling = (await resolveOrgAccess(db, orgId)) as OrgBilling;
    } catch (err) {
      const logger =
        (c.get('logger') as Logger | undefined) ||
        (createLogger({ c, service: 'quota-middleware', env: (c as AppContext).env }) as Logger);
      logger.error('Error resolving org access for quota check', {
        operation: 'resolve_org_access',
        orgId,
        originalError: err instanceof Error ? err.message : String(err),
      });
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'resolve_org_access',
      });
      return c.json(dbError, dbError.statusCode as 500);
    }

    const used = await getUsage(c, user);

    const limit = (orgBilling.quotas as unknown as Record<string, number>)[quotaKey];
    if (!isUnlimitedQuota(limit) && used + requested > limit) {
      const error = createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'quota_exceeded', quotaKey, used, limit, requested },
        `Quota exceeded: ${quotaKey}. Current usage: ${used}, Limit: ${isUnlimitedQuota(limit) ? 'unlimited' : limit}, Requested: ${requested}`,
      );
      return c.json(error, error.statusCode as 403);
    }

    c.set('orgBilling', orgBilling);
    c.set('quotas', orgBilling.quotas);

    await next();
  };
}
