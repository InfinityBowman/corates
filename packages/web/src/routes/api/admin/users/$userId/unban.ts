/**
 * Admin user unban
 *
 * POST /api/admin/users/:userId/unban — clears banned/banReason/banExpires.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { user } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { requireAdmin } from '@/server/guards/requireAdmin';

type HandlerArgs = { request: Request; params: { userId: string } };

export const handlePost = async ({ request, params }: HandlerArgs) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const { userId } = params;
  const db = createDb(env.DB);

  try {
    await db
      .update(user)
      .set({
        banned: false,
        banReason: null,
        banExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    return Response.json({ success: true, message: 'User unbanned successfully' }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error unbanning user:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'unban_user',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/users/$userId/unban')({
  server: { handlers: { POST: handlePost } },
});
