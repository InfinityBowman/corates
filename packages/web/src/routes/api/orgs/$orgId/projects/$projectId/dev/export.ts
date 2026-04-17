import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getProjectDocStub } from '@corates/workers/project-doc-id';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireProjectAccess } from '@/server/guards/requireProjectAccess';

type HandlerArgs = { request: Request; params: { orgId: string; projectId: string } };

export const handleGet = async ({ request, params }: HandlerArgs) => {
  if (!env.DEV_MODE) {
    return Response.json({ error: 'Dev endpoints disabled' }, { status: 403 });
  }

  const orgMembership = await requireOrgMembership(request, env, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const access = await requireProjectAccess(request, env, params.orgId, params.projectId);
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
    handlers: {
      GET: handleGet,
    },
  },
});
