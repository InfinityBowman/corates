/**
 * GET /api/auth/session — custom session payload used by WebSocket clients.
 *
 * Returns `{ user, session, sessionToken }` (matches the legacy Hono response
 * shape). On any error, returns 200 with `{ user: null, session: null }` so
 * the WS connect logic can fall back to anonymous mode without throwing.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createAuth } from '@corates/workers/auth-config';

type HandlerArgs = {
  request: Request;
  context?: { cloudflareCtx?: ExecutionContext };
};

export const handleGet = async ({ request, context }: HandlerArgs) => {
  try {
    const auth = createAuth(env, context?.cloudflareCtx);
    const session = await auth.api.getSession({ headers: request.headers });

    return Response.json({
      user: session?.user ?? null,
      session: session?.session ?? null,
      sessionToken: session?.session?.id ?? null,
    });
  } catch (error) {
    console.error('Session fetch error:', error);
    return Response.json({ user: null, session: null });
  }
};

export const Route = createFileRoute('/api/auth/session')({
  server: { middleware: [], handlers: { GET: handleGet } },
});
