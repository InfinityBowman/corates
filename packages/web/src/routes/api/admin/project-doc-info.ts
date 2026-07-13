import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { isAdminUser } from '@corates/workers/auth-admin';
import { getProjectDocStub } from '@corates/workers/project-doc-id';
import { authMiddleware, type Session } from '@/server/middleware/auth';

// Admin diagnostic endpoint: dumps the full ProjectDoc Y.Doc contents
// (checklist statuses, types, and raw stored answers) for a project.
// Read-only. Useful for investigating sync/persistence incidents where the
// client-side view of a project diverges from the server-side doc.
export const handleGet = async ({
  request,
  context: { session },
}: {
  request: Request;
  context: { session: Session };
}) => {
  if (!isAdminUser(session.user as { role?: string | null })) {
    return Response.json({ error: 'admin_required' }, { status: 403 });
  }

  const projectId = new URL(request.url).searchParams.get('projectId');
  if (!projectId) {
    return Response.json({ error: 'projectId query param required' }, { status: 400 });
  }

  const projectDoc = getProjectDocStub(env, projectId);
  const info = await projectDoc.getProjectInfo();
  return Response.json(info, { status: 200 });
};

export const Route = createFileRoute('/api/admin/project-doc-info')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: handleGet,
    },
  },
});
