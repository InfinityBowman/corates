import type { MiddlewareHandler } from 'hono';
import { createAuth } from '../auth/config';
import { isAdminUser } from '../auth/admin';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import type { AppContext, AuthUser } from '../types';

export const isAdmin = isAdminUser;

export const requireAdmin: MiddlewareHandler = async (c, next) => {
  try {
    const auth = createAuth((c as AppContext).env);
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.user) {
      const error = createDomainError(AUTH_ERRORS.REQUIRED);
      return c.json(error, error.statusCode as 401);
    }

    if (!isAdminUser(session.user as AuthUser)) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'admin_required' });
      return c.json(error, error.statusCode as 403);
    }

    c.set('user', session.user);
    c.set('session', session.session);
    c.set('isAdmin', true);

    await next();
  } catch (err) {
    console.error('Admin auth error:', err);
    const authError = createDomainError(AUTH_ERRORS.REQUIRED);
    return c.json(authError, authError.statusCode as 401);
  }
};
