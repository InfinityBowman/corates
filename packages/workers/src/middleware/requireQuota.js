/**
 * Quota middleware for Hono
 * Requires quota availability for protected routes
 * Must be used after requireOrgMembership middleware
 */

import { createDb } from '../db/client.js';
import { getAuth } from './auth.js';
import { getOrgContext } from './requireOrg.js';
import { resolveOrgAccess } from '../lib/billingResolver.js';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import { isUnlimitedQuota } from '@corates/shared/plans';

/**
 * Middleware that requires quota availability
 * Must be used after requireOrgMembership middleware
 * @param {string} quotaKey - Quota key (e.g., 'projects.max')
 * @param {Function} getUsage - Async function that returns current usage: (c, user) => Promise<number>
 * @param {number} [requested=1] - Amount requested (default: 1)
 * @returns {Function} Hono middleware
 */
export function requireQuota(quotaKey, getUsage, requested = 1) {
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

    // Get current usage
    const used = await getUsage(c, user);

    // Check quota from org billing
    const limit = orgBilling.quotas[quotaKey];
    if (!isUnlimitedQuota(limit) && used + requested > limit) {
      const error = createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'quota_exceeded', quotaKey, used, limit, requested },
        `Quota exceeded: ${quotaKey}. Current usage: ${used}, Limit: ${isUnlimitedQuota(limit) ? 'unlimited' : limit}, Requested: ${requested}`,
      );
      return c.json(error, error.statusCode);
    }

    // Attach org billing and quotas to context
    c.set('orgBilling', orgBilling);
    c.set('quotas', orgBilling.quotas);

    await next();
  };
}
