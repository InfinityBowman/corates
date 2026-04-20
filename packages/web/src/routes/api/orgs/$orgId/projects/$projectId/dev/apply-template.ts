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

export const handlePost = async ({ request, params, context: { db, session } }: HandlerArgs) => {
  if (!env.DEV_MODE) {
    return Response.json({ error: 'Dev endpoints disabled' }, { status: 403 });
  }

  const orgMembership = await requireOrgMembership(session, db, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const access = await requireProjectAccess(session, db, params.orgId, params.projectId);
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
    middleware: [authMiddleware],
    handlers: {
      POST: handlePost,
    },
  },
});
