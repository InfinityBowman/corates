/**
 * Org write access middleware for Hono
 * Blocks non-GET requests when org has read-only access
 * Must be used after requireOrgMembership middleware
 */

import { getOrgContext } from './requireOrg.js';
import { resolveOrgAccess } from '../lib/billingResolver.js';
import { createDb } from '../db/client.js';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';

/**
 * Middleware that requires write access (blocks read-only orgs)
 * Must be used after requireOrgMembership middleware
 * @returns {Function} Hono middleware
 */
export function requireOrgWriteAccess() {
  return async (c, next) => {
    // Only block non-GET requests
    if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
      await next();
      return;
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

    // Block writes only for expired grants (readOnly mode)
    // Free tier users can write to projects they belong to; project creation is gated by entitlements/quotas
    if (orgBilling.accessMode === 'readOnly') {
      const error = createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'read_only_access', source: orgBilling.source },
        'This organization has read-only access. Please renew your subscription or purchase a plan to make changes.',
      );
      return c.json(error, error.statusCode);
    }

    // Attach org billing to context for downstream use
    c.set('orgBilling', orgBilling);

    await next();
  };
}
