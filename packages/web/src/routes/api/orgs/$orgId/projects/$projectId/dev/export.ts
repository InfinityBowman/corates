import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import type { OrgId, ProjectId } from '@corates/shared/ids';
import { getProjectDocStub } from '@corates/workers/project-doc-id';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireProjectAccess } from '@/server/guards/requireProjectAccess';
import { authMiddleware, type Session } from '@/server/middleware/auth';

type HandlerArgs = {
  request: Request;
  params: { orgId: OrgId; projectId: ProjectId };
  context: { db: Database; session: Session };
};

export const handleGet = async ({ params, context: { db, session } }: HandlerArgs) => {
  if (!env.DEV_MODE) {
    return Response.json({ error: 'Dev endpoints disabled' }, { status: 403 });
  }

  const orgMembership = await requireOrgMembership(session, db, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const access = await requireProjectAccess(session, db, params.orgId, params.projectId);
  if (!access.ok) return access.response;

  try {
    const projectDoc = getProjectDocStub(env, params.projectId);
    const data = await projectDoc.devExport();
    return Response.json(data);
  } catch (err) {
    const error = err as Error;
    console.error('[Dev] Failed to export state:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/orgs/$orgId/projects/$projectId/dev/export')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: handleGet,
    },
  },
});
