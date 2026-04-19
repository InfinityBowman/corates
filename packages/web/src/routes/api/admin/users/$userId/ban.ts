/**
 * Admin user ban
 *
 * POST /api/admin/users/:userId/ban — sets the user's banned flag and
 * invalidates all of their sessions in a single batch. Body is optional;
 * supports `{ reason?, expiresAt? }` (ISO datetime).
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { user, session } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { adminMiddleware, type AdminContext } from '@/server/middleware/admin';

type HandlerArgs = {
  request: Request;
  params: { userId: string };
  context: { admin: AdminContext };
};

export const handlePost = async ({ request, params, context }: HandlerArgs) => {
  const { userId } = params;

  if (context.admin.userId === userId) {
    return Response.json(
      createValidationError(
        'userId',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        userId,
        'cannot_ban_self',
      ),
      { status: 400 },
    );
  }

  let reason: string | undefined;
  let expiresAt: Date | null = null;
  try {
    const body = (await request.json()) as { reason?: string; expiresAt?: string | null };
    reason = body?.reason;
    expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;
  } catch {
    // No body provided, use defaults
  }

  const db = createDb(env.DB);

  try {
    await db.batch([
      db
        .update(user)
        .set({
          banned: true,
          banReason: reason || 'Banned by administrator',
          banExpires: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId)),
      db.delete(session).where(eq(session.userId, userId)),
    ]);

    return Response.json({ success: true, message: 'User banned successfully' }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error banning user:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'ban_user',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/users/$userId/ban')({
  server: {
    middleware: [adminMiddleware],
    handlers: { POST: handlePost },
  },
});
