/**
 * POST /api/admin/stop-impersonation
 *
 * Cookie-authenticated escape hatch to end an admin impersonation session.
 * Lives outside the `requireAdmin` umbrella because the impersonated user
 * does not carry the admin role — the only protection here is the CSRF guard
 * (trusted Origin/Referer) plus better-auth's own session checks downstream.
 *
 * Forwards to better-auth's `/api/auth/admin/stop-impersonating` so it can
 * properly rotate the session cookie back to the original admin.
 */
import { createFileRoute } from '@tanstack/react-router';
import { logMiddleware, type RequestLogger } from '@/server/middleware/log';
import { env } from 'cloudflare:workers';
import { createAuth } from '@corates/workers/auth-config';
import { requireTrustedOrigin } from '@/server/guards/requireTrustedOrigin';

type HandlerArgs = { request: Request; context: { log: RequestLogger; cloudflareCtx?: ExecutionContext } };

export const handlePost = async ({ request, context }: HandlerArgs) => {
  const csrf = requireTrustedOrigin(request, { isProduction: env.ENVIRONMENT === 'production' });
  if (!csrf.ok) return csrf.response;

  try {
    const auth = createAuth(env, context?.cloudflareCtx);
    const url = new URL(request.url);

    const authUrl = new URL('/api/auth/admin/stop-impersonating', url.origin);
    const cookie = request.headers.get('cookie');
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');

    const headers = new Headers();
    if (cookie) headers.set('cookie', cookie);
    if (origin) headers.set('origin', origin);
    if (referer) headers.set('referer', referer);
    headers.set('accept', 'application/json');

    const authRequest = new Request(authUrl.toString(), { method: 'POST', headers });

    return await auth.handler(authRequest);
  } catch (error) {
    console.error('Error stopping impersonation:', error);
    return Response.json({ error: 'Failed to stop impersonation' }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/admin/stop-impersonation')({
  server: { middleware: [logMiddleware], handlers: { POST: handlePost } },
});
