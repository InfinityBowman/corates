import { getSession } from '@corates/workers/auth';
import { isAdminUser } from '@corates/workers/auth-admin';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import { requireTrustedOrigin } from './requireTrustedOrigin';

export interface AdminContext {
  userId: string;
  userEmail: string;
  userName: string | null;
  sessionId: string;
}

export type AdminGuardResult =
  | { ok: true; context: AdminContext }
  | { ok: false; response: Response };

/**
 * Admin gate: CSRF (mutations only) → session present → role === 'admin'.
 *
 * The Hono mount used to apply `requireTrustedOrigin` umbrella-style across
 * all admin routes. After the TanStack migration each admin handler calls
 * `requireAdmin` directly, so the CSRF check is bundled here to preserve
 * the original protection. The check internally short-circuits for
 * GET/HEAD/OPTIONS, so admin reads are unaffected.
 */
export async function requireAdmin(request: Request, env: Env): Promise<AdminGuardResult> {
  const csrf = requireTrustedOrigin(request, { isProduction: env.ENVIRONMENT === 'production' });
  if (!csrf.ok) return csrf;

  const session = await getSession(request, env);
  if (!session) {
    return {
      ok: false,
      response: Response.json(createDomainError(AUTH_ERRORS.REQUIRED), { status: 401 }),
    };
  }

  if (!isAdminUser(session.user as { role?: string | null })) {
    return {
      ok: false,
      response: Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'admin_required' }),
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    context: {
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      sessionId: session.session.id,
    },
  };
}
