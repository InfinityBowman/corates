import { getSession } from '@corates/workers/auth';
import { isAdminUser } from '@corates/workers/auth-admin';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';

export interface AdminContext {
  userId: string;
  userEmail: string;
  userName: string | null;
  sessionId: string;
}

export type AdminGuardResult =
  | { ok: true; context: AdminContext }
  | { ok: false; response: Response };

export async function requireAdmin(request: Request, env: Env): Promise<AdminGuardResult> {
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
