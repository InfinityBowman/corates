/**
 * Admin: revoke a specific session for a user
 *
 * DELETE /api/admin/users/:userId/sessions/:sessionId — verifies the session
 * belongs to the user before deleting; returns 404 otherwise.
 */
import { createFileRoute } from '@tanstack/react-router';
import type { Database } from '@corates/db/client';
import { session } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS, USER_ERRORS } from '@corates/shared';
import { adminMiddleware } from '@/server/middleware/admin';

type HandlerArgs = { request: Request; params: { userId: string; sessionId: string }; context: { db: Database } };

export const handleDelete = async ({ params, context: { db } }: HandlerArgs) => {
  const { userId, sessionId } = params;

  try {
    const [existingSession] = await db
      .select({ id: session.id, userId: session.userId })
      .from(session)
      .where(eq(session.id, sessionId))
      .limit(1);

    if (!existingSession || existingSession.userId !== userId) {
      return Response.json(createDomainError(USER_ERRORS.NOT_FOUND, { sessionId }), {
        status: 404,
      });
    }

    await db.delete(session).where(eq(session.id, sessionId));

    return Response.json({ success: true, message: 'Session revoked' }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error revoking session:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'revoke_session',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/users/$userId/sessions/$sessionId')({
  server: {
    middleware: [adminMiddleware],
    handlers: { DELETE: handleDelete },
  },
});
