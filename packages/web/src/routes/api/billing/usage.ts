/**
 * Org resource usage route
 *
 * GET /api/billing/usage — projects + non-owner member count for the active org.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { createDb } from '@corates/db/client';
import { getOrgResourceUsage } from '@corates/workers/billing-resolver';
import { createDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { resolveOrgId } from '@/server/billing-context';

export const handleGet = async ({ request }: { request: Request }) => {
  const session = await getSession(request, env);
  if (!session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401 });
  }

  const db = createDb(env.DB);

  try {
    const orgId = await resolveOrgId({
      db,
      session: session.session,
      userId: session.user.id,
    });

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'no_org_found' });
      return Response.json(error, { status: 403 });
    }

    const usage = await getOrgResourceUsage(db, orgId);
    return Response.json(
      { projects: usage.projects, collaborators: usage.collaborators },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching org usage:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_org_usage',
      originalError: error.message,
    });
    return Response.json(dbError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/billing/usage')({
  server: { handlers: { GET: handleGet } },
});
