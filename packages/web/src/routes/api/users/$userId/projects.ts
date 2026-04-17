import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { createDb } from '@corates/db/client';
import { projects, projectMembers } from '@corates/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';

interface UserProject {
  id: string;
  name: string;
  description: string | null;
  orgId: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export const handler = async ({
  request,
  params,
}: {
  request: Request;
  params: { userId: string };
}) => {
  const session = await getSession(request, env);
  if (!session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401 });
  }

  if (session.user.id !== params.userId) {
    const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
      reason: 'view_other_user_projects',
    });
    return Response.json(error, { status: 403 });
  }

  const db = createDb(env.DB);

  try {
    const results = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        orgId: projects.orgId,
        role: projectMembers.role,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(eq(projectMembers.userId, params.userId))
      .orderBy(desc(projects.updatedAt));

    return Response.json(results as unknown as UserProject[]);
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching user projects:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_user_projects',
      originalError: error.message,
    });
    return Response.json(dbError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/users/$userId/projects')({
  server: {
    handlers: {
      GET: handler,
    },
  },
});
