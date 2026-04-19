/**
 * Admin: revoke all sessions for a user
 *
 * DELETE /api/admin/users/:userId/sessions
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { session } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { adminMiddleware } from '@/server/middleware/admin';

type HandlerArgs = { request: Request; params: { userId: string } };

export const handleDelete = async ({ params }: HandlerArgs) => {
  const { userId } = params;
  const db = createDb(env.DB);

  try {
    await db.delete(session).where(eq(session.userId, userId));
    return Response.json({ success: true, message: 'All sessions revoked' }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error revoking sessions:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'revoke_sessions',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/users/$userId/sessions')({
  server: {
    middleware: [adminMiddleware],
    handlers: { DELETE: handleDelete },
  },
});
