/**
 * Catch-all for /api/auth/* -- forwards every request to better-auth's
 * `auth.handler`. Specific routes (`session.ts`, `verify-email.ts`,
 * `stripe/webhook.ts`) are matched first by TanStack's specificity rules
 * and never reach this handler.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createAuth } from '@corates/workers/auth-config';
import { logAuthHandlerSuccess } from '@corates/workers/auth-events';
import { captureError } from '@corates/workers/logger';

type HandlerArgs = {
  request: Request;
  context?: { cloudflareCtx?: ExecutionContext };
};

export const handle = async ({ request, context }: HandlerArgs) => {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    const auth = createAuth(env, context?.cloudflareCtx);
    const authUrl = new URL(path, url.origin);
    authUrl.search = url.search;
    const authRequest = new Request(authUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    const response = await auth.handler(authRequest);
    logAuthHandlerSuccess(path, response.status);
    return response;
  } catch (error) {
    const err = error as Error;
    captureError(error, { tags: { component: 'auth-routes', action: 'handler' } });
    return Response.json({ error: 'Authentication error', details: err.message }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/auth/$')({
  server: {
    middleware: [],
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
