/**
 * Admin middleware for Hono
 * Provides admin-only route protection
 */

import { createAuth } from '../auth/config.js';
import { isAdminUser } from '../auth/admin.js';

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
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (!isAdminUser(session.user)) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    c.set('user', session.user);
    c.set('session', session.session);
    c.set('isAdmin', true);

    await next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return c.json({ error: 'Authentication required' }, 401);
  }
}

export { isAdminUser as isAdmin } from '../auth/admin.js';
