import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import {
  createDomainError,
  createValidationError,
  isDomainError,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
  type DomainError,
} from '@corates/shared';
import type { OrgId, ProjectId, UserId } from '@corates/shared/ids';
import { updateMemberRole, removeMember } from '@corates/workers/commands/members';
import { requireMemberRemoval } from '@corates/workers/policies';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireProjectAccess } from '@/server/guards/requireProjectAccess';
import { requireOrgWriteAccess } from '@/server/guards/requireOrgWriteAccess';

type HandlerArgs = {
  request: Request;
  params: { orgId: OrgId; projectId: ProjectId; userId: UserId };
};

export const handlePut = async ({ request, params }: HandlerArgs) => {
  const orgMembership = await requireOrgMembership(request, env, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const writeAccess = await requireOrgWriteAccess(request.method, env, params.orgId);
  if (!writeAccess.ok) return writeAccess.response;

  const access = await requireProjectAccess(request, env, params.orgId, params.projectId, 'owner');
  if (!access.ok) return access.response;

  let body: { role?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    const error = createValidationError('body', VALIDATION_ERRORS.INVALID_INPUT.code, null);
    error.message = 'Invalid JSON input';
    return Response.json(error, { status: 400 });
  }

  const roleInput = typeof body.role === 'string' ? body.role : undefined;
  if (roleInput !== 'owner' && roleInput !== 'member') {
    return Response.json(
      createValidationError(
        'role',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        roleInput ?? null,
        'invalid_enum',
      ),
      { status: 400 },
    );
  }

  try {
    const result = await updateMemberRole(
      env,
      { id: access.context.userId },
      {
        orgId: params.orgId,
        projectId: params.projectId,
        userId: params.userId,
        role: roleInput,
      },
    );
    return Response.json(
      { success: true, userId: result.userId, role: result.role },
      { status: 200 },
    );
  } catch (err) {
    if (isDomainError(err)) {
      return Response.json(err, { status: 400 });
    }
    const error = err as Error;
    console.error('Error updating project member role:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'update_project_member_role',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const handleDelete = async ({ request, params }: HandlerArgs) => {
  const orgMembership = await requireOrgMembership(request, env, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const writeAccess = await requireOrgWriteAccess(request.method, env, params.orgId);
  if (!writeAccess.ok) return writeAccess.response;

  const access = await requireProjectAccess(request, env, params.orgId, params.projectId);
  if (!access.ok) return access.response;

  const db = createDb(env.DB);
  const isSelf = params.userId === access.context.userId;

  try {
    await requireMemberRemoval(db, access.context.userId, params.projectId, params.userId);
  } catch (err) {
    if (isDomainError(err)) {
      return Response.json(err, { status: (err as DomainError).statusCode });
    }
    throw err;
  }

  try {
    const result = await removeMember(
      env,
      { id: access.context.userId },
      {
        orgId: params.orgId,
        projectId: params.projectId,
        userId: params.userId,
        isSelfRemoval: isSelf,
      },
    );
    return Response.json({ success: true, removed: result.removed }, { status: 200 });
  } catch (err) {
    if (isDomainError(err)) {
      return Response.json(err, { status: (err as DomainError).statusCode });
    }
    const error = err as Error;
    console.error('Error removing project member:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'remove_project_member',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/orgs/$orgId/projects/$projectId/members/$userId')({
  server: {
    handlers: {
      PUT: handlePut,
      DELETE: handleDelete,
    },
  },
});
