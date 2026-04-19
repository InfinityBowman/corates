/**
 * Catch-all for /api/auth/* — forwards every request to better-auth's
 * `auth.handler`. Specific routes (`session.ts`, `verify-email.ts`,
 * `stripe/webhook.ts`) are matched first by TanStack's specificity rules
 * and never reach this handler.
 *
 * Sign-in/sign-up/forget-password/reset-password/magic-link paths get a
 * 15-minute auth-rate-limit; everything else passes through unthrottled
 * (parity with the previous Hono mount, which only rate-limited those
 * groups plus `/get-session`).
 */
import { createFileRoute } from '@tanstack/react-router';
import { logMiddleware, type RequestLogger } from '@/server/middleware/log';
import { env } from 'cloudflare:workers';
import { createAuth } from '@corates/workers/auth-config';
import { checkRateLimit, AUTH_RATE_LIMIT, SESSION_RATE_LIMIT } from '@/server/rateLimit';

const AUTH_RATE_LIMITED_PREFIXES = [
  '/api/auth/sign-in/',
  '/api/auth/sign-up/',
  '/api/auth/forget-password/',
  '/api/auth/reset-password/',
  '/api/auth/magic-link/',
];

type HandlerArgs = { request: Request; context: { log: RequestLogger; cloudflareCtx?: ExecutionContext } };

export const handle = async ({ request, context }: HandlerArgs) => {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/auth/get-session') {
    const rate = checkRateLimit(request, env, SESSION_RATE_LIMIT);
    if (rate.blocked) return rate.blocked;
  } else if (AUTH_RATE_LIMITED_PREFIXES.some(prefix => path.startsWith(prefix))) {
    const rate = checkRateLimit(request, env, AUTH_RATE_LIMIT);
    if (rate.blocked) return rate.blocked;
  }

  try {
    const auth = createAuth(env, context?.cloudflareCtx);
    const authUrl = new URL(path, url.origin);
    authUrl.search = url.search;
    const authRequest = new Request(authUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    return await auth.handler(authRequest);
  } catch (error) {
    const err = error as Error;
    console.error('Auth route error:', error);
    return Response.json({ error: 'Authentication error', details: err.message }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/auth/$')({
  server: {
    middleware: [logMiddleware],
    handlers: {
      GET: handle,
      POST: handle,
      PUT: handle,
      PATCH: handle,
      DELETE: handle,
      OPTIONS: handle,
      HEAD: handle,
    },
  },
});
