import type { MiddlewareHandler } from 'hono';
import { getOrgContext } from './requireOrg';
import { resolveOrgAccess } from '../lib/billingResolver';
import { createDb } from '../db/client';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import type { AppContext, OrgBilling } from '../types';

export function requireOrgWriteAccess(): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
      await next();
      return;
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

    if (orgBilling.accessMode === 'readOnly') {
      const error = createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'read_only_access', source: orgBilling.source },
        'This organization has read-only access. Please renew your subscription or purchase a plan to make changes.',
      );
      return c.json(error, error.statusCode as 403);
    }

    c.set('orgBilling', orgBilling);

    await next();
  };
}
