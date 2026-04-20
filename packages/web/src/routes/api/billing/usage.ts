/**
 * Org resource usage route
 *
 * GET /api/billing/usage — projects + non-owner member count for the active org.
 */
import { createFileRoute } from '@tanstack/react-router';
import type { Database } from '@corates/db/client';
import { getOrgResourceUsage } from '@corates/workers/billing-resolver';
import { createDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { resolveOrgId } from '@/server/billing-context';
import { authMiddleware, type Session } from '@/server/middleware/auth';

export type UsageResponse = { projects: number; collaborators: number };

export const handleGet = async ({
  context: { db, session },
}: {
  request: Request;
  context: { db: Database; session: Session };
}) => {
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
    const payload: UsageResponse = { projects: usage.projects, collaborators: usage.collaborators };
    return Response.json(payload, { status: 200 });
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
  server: { middleware: [authMiddleware], handlers: { GET: handleGet } },
});
