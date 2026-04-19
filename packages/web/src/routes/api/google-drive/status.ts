import { createFileRoute } from '@tanstack/react-router';
import type { Database } from '@corates/db/client';
import { account } from '@corates/db/schema';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, type Session } from '@/server/middleware/auth';

export const handler = async ({
  context: { db, session },
}: {
  request: Request;
  context: { db: Database; session: Session };
}) => {
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
    middleware: [authMiddleware],
    handlers: {
      GET: handler,
    },
  },
});
