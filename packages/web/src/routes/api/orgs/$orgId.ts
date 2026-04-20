import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import type { OrgId } from '@corates/shared/ids';
import { createAuth } from '@corates/workers/auth-config';
import type { Database } from '@corates/db/client';
import { projects } from '@corates/db/schema';
import { count, eq } from 'drizzle-orm';
import { createDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireOrgWriteAccess } from '@/server/guards/requireOrgWriteAccess';
import { authMiddleware, type Session } from '@/server/middleware/auth';

interface OrgApiMethods {
  getFullOrganization: (req: {
    headers: Headers;
    query: Record<string, string>;
  }) => Promise<unknown>;
  updateOrganization: (req: {
    headers: Headers;
    body: Record<string, unknown>;
  }) => Promise<unknown>;
  deleteOrganization: (req: {
    headers: Headers;
    body: Record<string, unknown>;
  }) => Promise<unknown>;
}

function getOrgApi(): OrgApiMethods {
  return createAuth(env).api as unknown as OrgApiMethods;
}

type HandlerArgs = { request: Request; params: { orgId: OrgId }; context: { db: Database; session: Session } };

export const handleGet = async ({ request, params, context: { db, session } }: HandlerArgs) => {
  const guard = await requireOrgMembership(session, db, params.orgId);
  if (!guard.ok) return guard.response;

  try {
    const orgApi = getOrgApi();
    const result = (await orgApi.getFullOrganization({
      headers: request.headers,
      query: { organizationId: params.orgId },
    })) as Record<string, unknown> | null;

    if (!result) {
      return Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, {
          reason: 'org_not_found',
          orgId: params.orgId,
        }),
        { status: 403 },
      );
    }

    const [projectCount] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.orgId, params.orgId));

    return Response.json({ ...result, projectCount: projectCount?.count || 0 }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching organization:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_organization',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const handlePut = async ({ request, params, context: { db, session } }: HandlerArgs) => {
  const membership = await requireOrgMembership(session, db, params.orgId, 'admin');
  if (!membership.ok) return membership.response;

  const writeAccess = await requireOrgWriteAccess(request.method, db, params.orgId);
  if (!writeAccess.ok) return writeAccess.response;

  try {
    const body = (await request.json()) as {
      name?: string;
      slug?: string;
      logo?: string;
      metadata?: Record<string, unknown>;
    };

    const orgApi = getOrgApi();
    const result = (await orgApi.updateOrganization({
      headers: request.headers,
      body: {
        organizationId: params.orgId,
        data: {
          name: body.name,
          slug: body.slug,
          logo: body.logo,
          metadata: body.metadata,
        },
      },
    })) as Record<string, unknown>;

    return Response.json(
      { success: true as const, orgId: params.orgId, ...result },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error updating organization:', error);
    if (error.message?.includes('slug')) {
      return Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'slug_taken' }), {
        status: 403,
      });
    }
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'update_organization',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const handleDelete = async ({ request, params, context: { db, session } }: HandlerArgs) => {
  const membership = await requireOrgMembership(session, db, params.orgId, 'owner');
  if (!membership.ok) return membership.response;

  const writeAccess = await requireOrgWriteAccess(request.method, db, params.orgId);
  if (!writeAccess.ok) return writeAccess.response;

  try {
    const orgApi = getOrgApi();
    await orgApi.deleteOrganization({
      headers: request.headers,
      body: { organizationId: params.orgId },
    });

    return Response.json({ success: true as const, deleted: params.orgId }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error deleting organization:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'delete_organization',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/orgs/$orgId')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: handleGet,
      PUT: handlePut,
      DELETE: handleDelete,
    },
  },
});
