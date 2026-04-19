import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createAuth } from '@corates/workers/auth-config';
import type { Database } from '@corates/db/client';
import { requireOrgMemberRemoval } from '@corates/workers/policies';
import {
  createDomainError,
  createValidationError,
  isDomainError,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import type { OrgId, UserId } from '@corates/shared/ids';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireOrgWriteAccess } from '@/server/guards/requireOrgWriteAccess';
import { dbMiddleware } from '@/server/middleware/db';

interface OrgApiMethods {
  updateMemberRole: (req: { headers: Headers; body: Record<string, unknown> }) => Promise<unknown>;
  removeMember: (req: { headers: Headers; body: Record<string, unknown> }) => Promise<unknown>;
  leaveOrganization: (req: { headers: Headers; body: Record<string, unknown> }) => Promise<unknown>;
}

function getOrgApi(): OrgApiMethods {
  return createAuth(env).api as unknown as OrgApiMethods;
}

// `memberId` in the URL is actually a user ID — better-auth's organization
// plugin removeMember endpoint accepts a userId, not a member-row id, and the
// downstream `requireOrgMemberRemoval` policy treats it as targetUserId. The
// path slug name is historical.
type HandlerArgs = {
  request: Request;
  params: { orgId: OrgId; memberId: UserId };
  context: { db: Database };
};

export const handlePut = async ({ request, params, context: { db } }: HandlerArgs) => {
  const membership = await requireOrgMembership(request, env, db, params.orgId, 'admin');
  if (!membership.ok) return membership.response;

  const writeAccess = await requireOrgWriteAccess(request.method, db, params.orgId);
  if (!writeAccess.ok) return writeAccess.response;

  try {
    const body = (await request.json()) as { role?: 'member' | 'admin' | 'owner' };

    if (!body.role) {
      return Response.json(
        createValidationError('role', VALIDATION_ERRORS.FIELD_REQUIRED.code, null, 'required'),
        { status: 400 },
      );
    }

    const orgApi = getOrgApi();
    await orgApi.updateMemberRole({
      headers: request.headers,
      body: {
        organizationId: params.orgId,
        memberId: params.memberId,
        role: body.role,
      },
    });

    return Response.json(
      { success: true as const, memberId: params.memberId, role: body.role },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error updating org member:', error);
    if (error.message?.includes('owner') || error.message?.includes('permission')) {
      return Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, {
          reason: 'owner_role_change_requires_owner',
        }),
        { status: 403 },
      );
    }
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'update_org_member',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const handleDelete = async ({ request, params, context: { db } }: HandlerArgs) => {
  const membership = await requireOrgMembership(request, env, db, params.orgId);
  if (!membership.ok) return membership.response;

  const writeAccess = await requireOrgWriteAccess(request.method, db, params.orgId);
  if (!writeAccess.ok) return writeAccess.response;

  const isSelf = params.memberId === membership.context.userId;

  try {
    await requireOrgMemberRemoval(db, membership.context.userId, params.orgId, params.memberId);
  } catch (err) {
    if (isDomainError(err)) {
      return Response.json(err, { status: 403 });
    }
    throw err;
  }

  try {
    const orgApi = getOrgApi();
    if (isSelf) {
      await orgApi.leaveOrganization({
        headers: request.headers,
        body: { organizationId: params.orgId },
      });
    } else {
      await orgApi.removeMember({
        headers: request.headers,
        body: {
          organizationId: params.orgId,
          memberIdOrEmail: params.memberId,
        },
      });
    }

    return Response.json(
      { success: true as const, removed: params.memberId, isSelf },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error removing org member:', error);
    if (error.message?.includes('owner') || error.message?.includes('last')) {
      return Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'cannot_remove_last_owner' }),
        { status: 403 },
      );
    }
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'remove_org_member',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/orgs/$orgId/members/$memberId')({
  server: {
    middleware: [dbMiddleware],
    handlers: {
      PUT: handlePut,
      DELETE: handleDelete,
    },
  },
});
