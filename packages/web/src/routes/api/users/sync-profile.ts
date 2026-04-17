import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { getProjectDocStub } from '@corates/workers/project-doc-id';
import { createDb } from '@corates/db/client';
import { projects, projectMembers, user } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { createDomainError, AUTH_ERRORS, USER_ERRORS, SYSTEM_ERRORS } from '@corates/shared';

export const handler = async ({ request }: { request: Request }) => {
  const auth = await getSession(request, env);
  if (!auth) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401 });
  }

  const db = createDb(env.DB);

  try {
    const [userData] = await db
      .select({
        name: user.name,
        givenName: user.givenName,
        familyName: user.familyName,
        image: user.image,
      })
      .from(user)
      .where(eq(user.id, auth.user.id))
      .limit(1);

    if (!userData) {
      const error = createDomainError(USER_ERRORS.NOT_FOUND, { userId: auth.user.id });
      return Response.json(error, { status: 404 });
    }

    const userProjects = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, auth.user.id));

    const results = await Promise.all(
      userProjects.map(async ({ projectId }) => {
        try {
          const projectDoc = getProjectDocStub(env, projectId);
          await projectDoc.syncMember('update', {
            userId: auth.user.id,
            name: userData.name,
            givenName: userData.givenName,
            familyName: userData.familyName,
            image: userData.image,
          });
          return { projectId, success: true };
        } catch (err) {
          console.error(`Failed to sync profile to project ${projectId}:`, err);
          return { projectId, success: false };
        }
      }),
    );

    const successCount = results.filter(r => r.success).length;

    return Response.json({
      success: true as const,
      synced: successCount,
      total: userProjects.length,
    });
  } catch (err) {
    const error = err as Error;
    console.error('Error syncing profile:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'sync_profile',
      originalError: error.message,
    });
    return Response.json(dbError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/users/sync-profile')({
  server: {
    handlers: {
      POST: handler,
    },
  },
});
