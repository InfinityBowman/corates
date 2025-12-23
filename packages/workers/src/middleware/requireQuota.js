/**
 * Quota middleware for Hono
 * Requires quota availability for protected routes
 */

import { createDb } from '../db/client.js';
import { getSubscriptionByUserId } from '../db/subscriptions.js';
import { getAuth } from './auth.js';
import { hasQuota, getEffectiveQuotas } from '../lib/entitlements.js';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import { isUnlimitedQuota } from '@corates/shared/plans';

/**
 * Middleware that requires quota availability
 * Must be used after requireAuth middleware
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

    const db = createDb(c.env.DB);
    const subscription = await getSubscriptionByUserId(db, user.id);

    // Get current usage
    const used = await getUsage(c, user);

    if (!hasQuota(subscription, quotaKey, { used, requested })) {
      const quotas = getEffectiveQuotas(subscription);
      const limit = quotas[quotaKey];
      const error = createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'quota_exceeded', quotaKey, used, limit, requested },
        `Quota exceeded: ${quotaKey}. Current usage: ${used}, Limit: ${isUnlimitedQuota(limit) ? 'unlimited' : limit}, Requested: ${requested}`,
      );
      return c.json(error, error.statusCode);
    }

    // Attach subscription and quotas to context
    c.set('subscription', subscription);
    c.set('quotas', getEffectiveQuotas(subscription));

    await next();
  };
}
