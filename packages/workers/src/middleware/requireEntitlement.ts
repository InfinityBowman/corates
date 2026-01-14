import type { MiddlewareHandler } from 'hono';
import { createDb } from '../db/client';
import { getAuth } from './auth';
import { getOrgContext } from './requireOrg';
import { resolveOrgAccess } from '../lib/billingResolver';
import { createDomainError, AUTH_ERRORS, SYSTEM_ERRORS, isDomainError } from '@corates/shared';
import type { AppContext, OrgBilling } from '../types';

export function requireEntitlement(entitlement: string): MiddlewareHandler {
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

    const db = createDb((c as AppContext).env.DB);

    let orgBilling: OrgBilling;
    try {
      orgBilling = (await resolveOrgAccess(db, orgId)) as OrgBilling;
    } catch (err) {
      if (isDomainError(err)) {
        return c.json(err, err.statusCode as 400 | 403 | 500);
      }
      const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'resolve_org_access',
        originalError: err instanceof Error ? err.message : String(err),
      });
      return c.json(error, error.statusCode as 500);
    }

    if (!(orgBilling.entitlements as unknown as Record<string, boolean>)[entitlement]) {
      const error = createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'missing_entitlement', entitlement },
        `This feature requires the '${entitlement}' entitlement. Please upgrade your plan.`,
      );
      return c.json(error, error.statusCode as 403);
    }

    c.set('orgBilling', orgBilling);
    c.set('entitlements', orgBilling.entitlements);

    await next();
  };
}
