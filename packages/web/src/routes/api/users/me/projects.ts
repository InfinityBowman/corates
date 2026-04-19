import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import type { Database } from '@corates/db/client';
import { projects, projectMembers } from '@corates/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { dbMiddleware } from '@/server/middleware/db';

export interface UserProject {
  id: string;
  name: string;
  description: string | null;
  orgId: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

const handler = async ({
  request,
  context: { db },
}: {
  request: Request;
  context: { db: Database };
}) => {
  const session = await getSession(request, env);
  if (!session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401 });
  }

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
      .where(eq(projectMembers.userId, session.user.id))
      .orderBy(desc(projects.updatedAt));

    // Dates are serialized to ISO strings by Response.json. Cast matches the
    // pre-migration Hono schema shape the client still expects.
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

export const Route = createFileRoute('/api/users/me/projects')({
  server: {
    middleware: [dbMiddleware],
    handlers: {
      GET: handler,
    },
  },
});
