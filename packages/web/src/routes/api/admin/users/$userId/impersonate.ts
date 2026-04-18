/**
 * Admin user impersonation
 *
 * POST /api/admin/users/:userId/impersonate — proxies to better-auth's
 * /api/auth/admin/impersonate-user so cookie semantics are handled by the
 * auth library. Self-impersonation is rejected with 400.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createAuth } from '@corates/workers/auth-config';
import {
  createDomainError,
  createValidationError,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { requireAdmin } from '@/server/guards/requireAdmin';

type HandlerArgs = { request: Request; params: { userId: string } };

export const handlePost = async ({ request, params }: HandlerArgs) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const { userId } = params;

  if (guard.context.userId === userId) {
    return Response.json(
      createValidationError(
        'userId',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        userId,
        'cannot_impersonate_self',
      ),
      { status: 400 },
    );
  }

  try {
    const body = (await request.json()) as { userId?: string };
    if (!body?.userId) {
      return Response.json(
        createValidationError(
          'userId',
          VALIDATION_ERRORS.FIELD_REQUIRED.code,
          body?.userId ?? null,
          'required',
        ),
        { status: 400 },
      );
    }

    const auth = createAuth(env);
    const url = new URL(request.url);
    const authUrl = new URL('/api/auth/admin/impersonate-user', url.origin);

    const cookie = request.headers.get('cookie');
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const headers = new Headers();
    if (cookie) headers.set('cookie', cookie);
    if (origin) headers.set('origin', origin);
    if (referer) headers.set('referer', referer);
    headers.set('content-type', 'application/json');
    headers.set('accept', 'application/json');

    const authRequest = new Request(authUrl.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: body.userId }),
    });

    const response = await auth.handler(authRequest);

    if (response.status === 403 && env.ENVIRONMENT !== 'production') {
      try {
        const respBody = await response.clone().text();
        console.log('[Admin] Impersonation forbidden:', respBody);
      } catch {
        // ignore
      }
    }

    return response;
  } catch (err) {
    const error = err as Error;
    console.error('Error impersonating user:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'impersonate_user',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/users/$userId/impersonate')({
  server: { handlers: { POST: handlePost } },
});
