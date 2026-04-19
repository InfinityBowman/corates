/**
 * Admin route middleware.
 *
 * Composes authMiddleware (log + db + session) with admin-role + CSRF checks.
 *
 * Apply to a route via:
 *   server: { middleware: [adminMiddleware], handlers: { GET: handleGet } }
 *
 * Inside the handler, `context.db`, `context.admin`, and `context.session` are typed.
 */
import { createMiddleware } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { isAdminUser } from '@corates/workers/auth-admin';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import { requireTrustedOrigin } from '@/server/guards/requireTrustedOrigin';
import { authMiddleware } from './auth';

export interface AdminContext {
  userId: string;
  userEmail: string;
  userName: string | null;
  sessionId: string;
}

export const adminMiddleware = createMiddleware()
  .middleware([authMiddleware])
  .server(async ({ next, request, context }) => {
    const csrf = requireTrustedOrigin(request, { isProduction: env.ENVIRONMENT === 'production' });
    if (!csrf.ok) throw csrf.response;

    if (!isAdminUser(context.session.user as { role?: string | null })) {
      throw Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'admin_required' }), {
        status: 403,
      });
    }

    const admin: AdminContext = {
      userId: context.session.user.id,
      userEmail: context.session.user.email,
      userName: context.session.user.name,
      sessionId: context.session.session.id,
    };

    return next({ context: { admin } });
  });
