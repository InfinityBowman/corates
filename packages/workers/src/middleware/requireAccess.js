/**
 * Access control middleware for Hono
 * Requires active time-limited access for protected routes
 */

import { createDb } from '../db/client.js';
import { getSubscriptionByUserId } from '../db/subscriptions.js';
import { getAuth } from './auth.js';
import { hasActiveAccess, isAccessExpired } from '../lib/access.js';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';

/**
 * Middleware that requires active access
 * Must be used after requireAuth middleware
 * @returns {Function} Hono middleware
 */
export function requireAccess() {
  return async (c, next) => {
    const { user } = getAuth(c);

    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const db = createDb(c.env.DB);
    const subscription = await getSubscriptionByUserId(db, user.id);

    // Check if user has active access
    if (!hasActiveAccess(subscription)) {
      const error = createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'project_creation' },
        subscription && isAccessExpired(subscription) ?
          'Your access has expired. Please contact support to renew your access.'
        : 'Active access is required to create projects. Please contact support to request access.',
      );

      // Add expiration info if available
      if (subscription?.currentPeriodEnd) {
        error.details = {
          expiredAt: subscription.currentPeriodEnd,
          expiredAtFormatted: new Date(subscription.currentPeriodEnd * 1000).toISOString(),
        };
      }

      return c.json(error, error.statusCode);
    }

    // Attach subscription to context for downstream use
    c.set('subscription', subscription);

    await next();
  };
}
