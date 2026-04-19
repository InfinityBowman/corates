import { createFileRoute } from '@tanstack/react-router';
import type { Database } from '@corates/db/client';
import { account } from '@corates/db/schema';
import { and, eq } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { authMiddleware, type Session } from '@/server/middleware/auth';

export const handler = async ({
  context: { db, session },
}: {
  request: Request;
  context: { db: Database; session: Session };
}) => {
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
    middleware: [authMiddleware],
    handlers: {
      DELETE: handler,
    },
  },
});
