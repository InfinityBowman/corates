import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { createDb } from '@corates/db/client';
import { account } from '@corates/db/schema';
import { eq, and } from 'drizzle-orm';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';

export const handler = async ({ request }: { request: Request }) => {
  const session = await getSession(request, env);
  if (!session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401 });
  }

  const db = createDb(env.DB);
  const googleAccount = await db
    .select({
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
    })
    .from(account)
    .where(and(eq(account.userId, session.user.id), eq(account.providerId, 'google')))
    .get();

  return Response.json({
    connected: !!googleAccount?.accessToken,
    hasRefreshToken: !!googleAccount?.refreshToken,
  });
};

export const Route = createFileRoute('/api/google-drive/status')({
  server: {
    handlers: {
      GET: handler,
    },
  },
});
