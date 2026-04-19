import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import type { OrgId, ProjectId } from '@corates/shared/ids';
import { getProjectDocStub } from '@corates/workers/project-doc-id';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireProjectAccess } from '@/server/guards/requireProjectAccess';
import { dbMiddleware } from '@/server/middleware/db';

type HandlerArgs = {
  request: Request;
  params: { orgId: OrgId; projectId: ProjectId };
  context: { db: Database };
};

export const handlePost = async ({ request, params, context: { db } }: HandlerArgs) => {
  if (!env.DEV_MODE) {
    return Response.json({ error: 'Dev endpoints disabled' }, { status: 403 });
  }

  const orgMembership = await requireOrgMembership(request, env, db, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const access = await requireProjectAccess(request, env, db, params.orgId, params.projectId);
  if (!access.ok) return access.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const projectDoc = getProjectDocStub(env, params.projectId);
    const data = await projectDoc.devImport({
      ...body,
      targetOrgId: access.context.orgId,
      importer: {
        userId: access.context.userId,
        email: access.context.userEmail,
        name: null,
        image: null,
      },
    });
    return Response.json(data);
  } catch (err) {
    const error = err as Error;
    console.error('[Dev] Failed to import state:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/orgs/$orgId/projects/$projectId/dev/import')({
  server: {
    middleware: [dbMiddleware],
    handlers: {
      POST: handlePost,
    },
  },
});
