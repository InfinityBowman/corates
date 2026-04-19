/**
 * Admin route middleware.
 *
 * Pilot replacement for the hand-rolled `requireAdmin(request, env)` guard
 * called at the top of every admin handler. Composes:
 *
 *   dbMiddleware     — creates Drizzle client, attaches `context.db`
 *   authMiddleware   — session present, attaches `context.session`
 *   adminMiddleware  — CSRF (mutations only) + admin role, attaches `context.admin`
 *
 * Apply to a route via:
 *   server: { middleware: [adminMiddleware], handlers: { GET: handleGet } }
 *
 * Inside the handler, `context.db`, `context.admin`, and `context.session` are typed.
 */
import { createMiddleware } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { isAdminUser } from '@corates/workers/auth-admin';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import { requireTrustedOrigin } from '@/server/guards/requireTrustedOrigin';
import { dbMiddleware } from './db';

export interface AdminContext {
  userId: string;
  userEmail: string;
  userName: string | null;
  sessionId: string;
}

const authMiddleware = createMiddleware()
  .middleware([dbMiddleware])
  .server(async ({ next, request }) => {
    const session = await getSession(request, env);
    if (!session) {
      throw Response.json(createDomainError(AUTH_ERRORS.REQUIRED), { status: 401 });
    }
    return next({ context: { session } });
  });

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
