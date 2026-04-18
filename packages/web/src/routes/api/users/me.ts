import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { createDb } from '@corates/db/client';
import {
  projects,
  projectMembers,
  user,
  session as sessionTable,
  account,
  verification,
  twoFactor,
  mediaFiles,
} from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { syncMemberToDO } from '@corates/workers/project-sync';
import { createDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';

export const handleDelete = async ({ request }: { request: Request }) => {
  const auth = await getSession(request, env);
  if (!auth) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401 });
  }

  const db = createDb(env.DB);
  const userId = auth.user.id;

  try {
    const userProjects = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, userId));

    await Promise.all(
      userProjects.map(({ projectId }) => syncMemberToDO(env, projectId, 'remove', { userId })),
    );

    await db.batch([
      db.update(mediaFiles).set({ uploadedBy: null }).where(eq(mediaFiles.uploadedBy, userId)),
      db.delete(projectMembers).where(eq(projectMembers.userId, userId)),
      db.delete(projects).where(eq(projects.createdBy, userId)),
      db.delete(twoFactor).where(eq(twoFactor.userId, userId)),
      db.delete(sessionTable).where(eq(sessionTable.userId, userId)),
      db.delete(account).where(eq(account.userId, userId)),
      db.delete(verification).where(eq(verification.identifier, auth.user.email)),
      db.delete(user).where(eq(user.id, userId)),
    ]);

    console.log(`Account deleted successfully for user: ${userId}`);

    return Response.json({ success: true as const, message: 'Account deleted successfully' });
  } catch (err) {
    const error = err as Error;
    console.error('Error deleting account:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'delete_account',
      originalError: error.message,
    });
    return Response.json(dbError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/users/me')({
  server: {
    handlers: {
      DELETE: handleDelete,
    },
  },
});
