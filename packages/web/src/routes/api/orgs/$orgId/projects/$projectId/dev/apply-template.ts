import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import type { OrgId, ProjectId } from '@corates/shared/ids';
import { getProjectDocStub } from '@corates/workers/project-doc-id';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireProjectAccess } from '@/server/guards/requireProjectAccess';

type HandlerArgs = { request: Request; params: { orgId: OrgId; projectId: ProjectId } };

export const handlePost = async ({ request, params }: HandlerArgs) => {
  if (!env.DEV_MODE) {
    return Response.json({ error: 'Dev endpoints disabled' }, { status: 403 });
  }

  const orgMembership = await requireOrgMembership(request, env, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const access = await requireProjectAccess(request, env, params.orgId, params.projectId);
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const template = url.searchParams.get('template') || undefined;
  const mode = (url.searchParams.get('mode') as 'replace' | 'merge' | null) || 'replace';

  if (!template) {
    return Response.json({ error: 'template query parameter is required' }, { status: 400 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      userMapping?: Record<string, string>;
    };
    const projectDoc = getProjectDocStub(env, params.projectId);
    const data = await projectDoc.devApplyTemplate(template, mode, body.userMapping);
    return Response.json(data);
  } catch (err) {
    const error = err as Error;
    console.error('[Dev] Failed to apply template:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/orgs/$orgId/projects/$projectId/dev/apply-template')({
  server: {
    handlers: {
      POST: handlePost,
    },
  },
});
