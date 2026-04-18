/**
 * Org members route (billing-context list)
 *
 * GET /api/billing/members — delegates to Better Auth's organization plugin to
 * list members of the caller's active org.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { createAuth } from '@corates/workers/auth-config';
import { createDb } from '@corates/db/client';
import { createDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { resolveOrgId } from '@/server/billing-context';

interface ListMembersApi {
  listMembers: (req: {
    headers: Headers;
    query: { organizationId: string };
  }) => Promise<{ members?: Array<Record<string, unknown>> }>;
}

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

    const auth = createAuth(env);
    const api = auth.api as unknown as ListMembersApi;
    const result = await api.listMembers({
      headers: request.headers,
      query: { organizationId: orgId },
    });

    const members = result.members || [];
    return Response.json({ members, count: members.length }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching org members:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_org_members',
      originalError: error.message,
    });
    return Response.json(dbError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/billing/members')({
  server: { handlers: { GET: handleGet } },
});
