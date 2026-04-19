import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createAuth } from '@corates/workers/auth-config';
import type { Database } from '@corates/db/client';
import { dbMiddleware } from '@/server/middleware/db';
import {
  createDomainError,
  createValidationError,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import type { OrgId } from '@corates/shared/ids';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireOrgWriteAccess } from '@/server/guards/requireOrgWriteAccess';

interface OrgApiMethods {
  listMembers: (req: { headers: Headers; query: Record<string, string> }) => Promise<unknown>;
  addMember: (req: { headers: Headers; body: Record<string, unknown> }) => Promise<unknown>;
}

function getOrgApi(): OrgApiMethods {
  return createAuth(env).api as unknown as OrgApiMethods;
}

type HandlerArgs = { request: Request; params: { orgId: OrgId }; context: { db: Database } };

export const handleGet = async ({ request, params, context: { db } }: HandlerArgs) => {
  const membership = await requireOrgMembership(request, env, db, params.orgId);
  if (!membership.ok) return membership.response;

  try {
    const orgApi = getOrgApi();
    const result = await orgApi.listMembers({
      headers: request.headers,
      query: { organizationId: params.orgId },
    });
    return Response.json(result, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error listing org members:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'list_org_members',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const handlePost = async ({ request, params, context: { db } }: HandlerArgs) => {
  const membership = await requireOrgMembership(request, env, db, params.orgId, 'admin');
  if (!membership.ok) return membership.response;

  const writeAccess = await requireOrgWriteAccess(request.method, db, params.orgId);
  if (!writeAccess.ok) return writeAccess.response;

  try {
    const body = (await request.json()) as { userId?: string; role?: 'member' | 'admin' | 'owner' };

    if (!body.userId) {
      return Response.json(
        createValidationError('userId', VALIDATION_ERRORS.FIELD_REQUIRED.code, null, 'required'),
        { status: 400 },
      );
    }

    const orgApi = getOrgApi();
    const result = (await orgApi.addMember({
      headers: request.headers,
      body: {
        organizationId: params.orgId,
        userId: body.userId,
        role: body.role ?? 'member',
      },
    })) as Record<string, unknown>;

    return Response.json({ success: true as const, ...result }, { status: 201 });
  } catch (err) {
    const error = err as Error;
    console.error('Error adding org member:', error);
    if (error.message?.includes('already') || error.message?.includes('member')) {
      return Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'already_member' }), {
        status: 403,
      });
    }
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'add_org_member',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/orgs/$orgId/members')({
  server: {
    middleware: [dbMiddleware],
    handlers: {
      GET: handleGet,
      POST: handlePost,
    },
  },
});
