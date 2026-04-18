/**
 * Admin project doc stats
 *
 * GET /api/admin/projects/:projectId/doc-stats — DO storage stats (rows, byte
 * totals, encoded snapshot size, memory usage %, content counts). Wakes the
 * ProjectDoc DO. The 404 path checks D1 first to avoid waking a DO for a
 * project that doesn't exist.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { projects } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { createDomainError, PROJECT_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { getProjectDocStub } from '@corates/workers/project-doc-id';
import { requireAdmin } from '@/server/guards/requireAdmin';

type HandlerArgs = { request: Request; params: { projectId: string } };

export const handleGet = async ({ request, params }: HandlerArgs) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const { projectId } = params;
  const db = createDb(env.DB);

  try {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return Response.json(createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId }), {
        status: 404,
      });
    }

    const projectDoc = getProjectDocStub(env, projectId);
    const stats = await projectDoc.getStorageStats();
    return Response.json(stats, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching project doc stats:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, { message: error.message }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/projects/$projectId/doc-stats')({
  server: { handlers: { GET: handleGet } },
});
