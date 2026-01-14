import type { Context, MiddlewareHandler } from 'hono';
import { createAuth } from '../auth/config.js';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import type { AuthUser, AuthSession } from '../types/context';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
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
};

export const requireAuth: MiddlewareHandler = async (c, next) => {
  try {
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.user) {
      const error = createDomainError(AUTH_ERRORS.REQUIRED);
      return c.json(error, error.statusCode as 401);
    }

    c.set('user', session.user);
    c.set('session', session.session);

    await next();
  } catch (error) {
    console.error('Auth verification error:', error);
    const authError = createDomainError(AUTH_ERRORS.REQUIRED);
    return c.json(authError, authError.statusCode as 401);
  }
};

export function getAuth(c: Context): { user: AuthUser | null; session: AuthSession | null } {
  return {
    user: c.get('user') as AuthUser | null,
    session: c.get('session') as AuthSession | null,
  };
}
