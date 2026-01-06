/**
 * Admin middleware for Hono
 * Provides admin-only route protection
 */

import { createAuth } from '../auth/config.js';
import { isAdminUser } from '../auth/admin.js';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';

export const isAdmin = isAdminUser;

/**
 * Middleware that requires admin privileges
 * Returns 403 if not an admin
 */
export async function requireAdmin(c, next) {
  try {
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.user) {
      const error = createDomainError(AUTH_ERRORS.REQUIRED);
      return c.json(error, error.statusCode);
    }

    if (!isAdminUser(session.user)) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'admin_required' });
      return c.json(error, error.statusCode);
    }

    c.set('user', session.user);
    c.set('session', session.session);
    c.set('isAdmin', true);

    await next();
  } catch (error) {
    console.error('Admin auth error:', error);
    const authError = createDomainError(AUTH_ERRORS.REQUIRED);
    return c.json(authError, authError.statusCode);
  }
}
