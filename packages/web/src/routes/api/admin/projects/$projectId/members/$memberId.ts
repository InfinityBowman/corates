/**
 * Admin remove project member
 *
 * DELETE /api/admin/projects/:projectId/members/:memberId — removes a member
 * row from a project. Admin only.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { projectMembers } from '@corates/db/schema';
import { and, eq } from 'drizzle-orm';
import { createDomainError, PROJECT_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { adminMiddleware } from '@/server/middleware/admin';

type HandlerArgs = { request: Request; params: { projectId: string; memberId: string } };

export const handleDelete = async ({ params }: HandlerArgs) => {
  const { projectId, memberId } = params;
  const db = createDb(env.DB);

  try {
    const [existingMember] = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(eq(projectMembers.id, memberId), eq(projectMembers.projectId, projectId)))
      .limit(1);

    if (!existingMember) {
      return Response.json(createDomainError(PROJECT_ERRORS.NOT_FOUND, { memberId }), {
        status: 404,
      });
    }

    await db.delete(projectMembers).where(eq(projectMembers.id, memberId));

    return Response.json(
      { success: true, message: 'Member removed from project' },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error removing project member:', error);
    return Response.json(createDomainError(SYSTEM_ERRORS.DB_ERROR, { message: error.message }), {
      status: 500,
    });
  }
};

export const Route = createFileRoute('/api/admin/projects/$projectId/members/$memberId')({
  server: {
    middleware: [adminMiddleware],
    handlers: { DELETE: handleDelete },
  },
});
