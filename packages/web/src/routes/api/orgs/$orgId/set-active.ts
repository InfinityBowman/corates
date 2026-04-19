import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createAuth } from '@corates/workers/auth-config';
import type { Database } from '@corates/db/client';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import type { OrgId } from '@corates/shared/ids';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { authMiddleware } from '@/server/middleware/auth';

interface OrgApiMethods {
  setActiveOrganization: (req: {
    headers: Headers;
    body: Record<string, unknown>;
  }) => Promise<unknown>;
}

function getOrgApi(): OrgApiMethods {
  return createAuth(env).api as unknown as OrgApiMethods;
}

export const handler = async ({
  request,
  params,
  context: { db },
}: {
  request: Request;
  params: { orgId: OrgId };
  context: { db: Database };
}) => {
  const guard = await requireOrgMembership(request, env, db, params.orgId);
  if (!guard.ok) return guard.response;

  try {
    const orgApi = getOrgApi();
    await orgApi.setActiveOrganization({
      headers: request.headers,
      body: { organizationId: params.orgId },
    });

    return Response.json(
      { success: true as const, activeOrganizationId: params.orgId },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error setting active organization:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'set_active_organization',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/orgs/$orgId/set-active')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: handler,
    },
  },
});
