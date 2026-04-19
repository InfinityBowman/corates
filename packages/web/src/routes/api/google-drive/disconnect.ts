import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import type { Database } from '@corates/db/client';
import { account } from '@corates/db/schema';
import { and, eq } from 'drizzle-orm';
import { createDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { dbMiddleware } from '@/server/middleware/db';

export const handler = async ({
  request,
  context: { db },
}: {
  request: Request;
  context: { db: Database };
}) => {
  const session = await getSession(request, env);
  if (!session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401 });
  }

  try {
    await db
      .delete(account)
      .where(and(eq(account.userId, session.user.id), eq(account.providerId, 'google')));

    return Response.json(
      { success: true as const, message: 'Google account disconnected' },
      { status: 200 },
    );
  } catch (error) {
    console.error('Google disconnect error:', error);
    const err = error as Error;
    const systemError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'disconnect_google_account',
      originalError: err?.message || String(error),
    });
    return Response.json(systemError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/google-drive/disconnect')({
  server: {
    middleware: [dbMiddleware],
    handlers: {
      DELETE: handler,
    },
  },
});
