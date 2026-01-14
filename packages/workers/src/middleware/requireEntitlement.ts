import type { MiddlewareHandler } from 'hono';
import { createDb } from '../db/client';
import { getAuth } from './auth';
import { getOrgContext } from './requireOrg';
import { resolveOrgAccess } from '../lib/billingResolver';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
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
    const orgBilling = (await resolveOrgAccess(db, orgId)) as OrgBilling;

    if (!orgBilling.entitlements[entitlement]) {
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
