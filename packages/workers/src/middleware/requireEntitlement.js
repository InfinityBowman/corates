/**
 * Entitlement middleware for Hono
 * Requires a specific entitlement for protected routes
 * Must be used after requireOrgMembership middleware
 */

import { createDb } from '../db/client.js';
import { getAuth } from './auth.js';
import { getOrgContext } from './requireOrg.js';
import { resolveOrgAccess } from '../lib/billingResolver.js';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';

/**
 * Middleware that requires a specific entitlement
 * Must be used after requireOrgMembership middleware
 * @param {string} entitlement - Entitlement key (e.g., 'project.create')
 * @returns {Function} Hono middleware
 */
export function requireEntitlement(entitlement) {
  return async (c, next) => {
    const { user } = getAuth(c);

    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const { orgId } = getOrgContext(c);
    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'org_context_required',
      });
      return c.json(error, error.statusCode);
    }

    const db = createDb(c.env.DB);
    const orgBilling = await resolveOrgAccess(db, orgId);

    // Check entitlement from org billing
    if (!orgBilling.entitlements[entitlement]) {
      const error = createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'missing_entitlement', entitlement },
        `This feature requires the '${entitlement}' entitlement. Please upgrade your plan.`,
      );
      return c.json(error, error.statusCode);
    }

    // Attach org billing to context
    c.set('orgBilling', orgBilling);
    c.set('entitlements', orgBilling.entitlements);

    await next();
  };
}
