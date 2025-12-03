/**
 * Auth middleware for Hono
 * Provides authentication verification for protected routes
 */

import { createAuth } from '../auth/config.js';

/**
 * Auth middleware that attaches user and session to context
 * Does not block unauthenticated requests - use requireAuth for that
 */
export async function authMiddleware(c, next) {
  try {
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    c.set('user', session?.user || null);
    c.set('session', session?.session || null);
  } catch (error) {
    console.error('Auth middleware error:', error);
    c.set('user', null);
    c.set('session', null);
  }

  await next();
}

/**
 * Middleware that requires authentication
 * Returns 401 if not authenticated
 */
export async function requireAuth(c, next) {
  try {
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    c.set('user', session.user);
    c.set('session', session.session);

    await next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return c.json({ error: 'Authentication required' }, 401);
  }
}

/**
 * Get the authenticated user from context
 * @param {Object} c - Hono context
 * @returns {{ user: Object|null, session: Object|null }}
 */
export function getAuth(c) {
  return {
    user: c.get('user'),
    session: c.get('session'),
  };
}
