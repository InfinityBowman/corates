/**
 * Entitlement middleware for Hono
 * Requires a specific entitlement for protected routes
 */

import { createDb } from '../db/client.js';
import { getSubscriptionByUserId } from '../db/subscriptions.js';
import { getAuth } from './auth.js';
import { hasEntitlement, getEffectiveEntitlements } from '../lib/entitlements.js';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';

/**
 * Middleware that requires a specific entitlement
 * Must be used after requireAuth middleware
 * @param {string} entitlement - Entitlement key (e.g., 'project.create')
 * @returns {Function} Hono middleware
 */
export function requireEntitlement(entitlement) {
  return async (c, next) => {
    const { user } = getAuth(c);

    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const db = createDb(c.env.DB);
    const subscription = await getSubscriptionByUserId(db, user.id);

    if (!hasEntitlement(subscription, entitlement)) {
      const error = createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'missing_entitlement', entitlement },
        `This feature requires the '${entitlement}' entitlement. Please upgrade your plan.`,
      );
      return c.json(error, error.statusCode);
    }

    // Attach subscription and entitlements to context
    c.set('subscription', subscription);
    c.set('entitlements', getEffectiveEntitlements(subscription));

    await next();
  };
}
