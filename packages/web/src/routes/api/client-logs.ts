/**
 * POST /api/client-logs — relay browser structured events into the worker logger.
 *
 * Session is optional so pre-auth flows (sign-in failures) can still emit.
 * userId is taken from the server session when present; client-supplied ids are
 * stripped during sanitization.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { runWithContext } from '@corates/workers/logger';
import {
  clientLogBodySchema,
  emitClientLogEntry,
} from '@/server/client-logs';

type HandlerArgs = {
  request: Request;
};

export const handlePost = async ({ request }: HandlerArgs) => {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const parsed = clientLogBodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(null, { status: 400 });
  }

  const session = await getSession(request, env);
  const userId = session?.user.id;

  const emitAll = () => {
    for (const entry of parsed.data.entries) {
      emitClientLogEntry(entry, userId);
    }
  };

  if (userId) {
    runWithContext({ userId }, emitAll);
  } else {
    emitAll();
  }

  return new Response(null, { status: 204 });
};

export const Route = createFileRoute('/api/client-logs')({
  server: {
    middleware: [],
    handlers: {
      POST: handlePost,
    },
  },
});
