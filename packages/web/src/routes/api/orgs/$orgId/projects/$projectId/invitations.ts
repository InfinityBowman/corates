import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import { projectInvitations } from '@corates/db/schema';
import { and, eq, desc, isNull } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  isDomainError,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
  type DomainError,
} from '@corates/shared';
import type { OrgId, ProjectId } from '@corates/shared/ids';
import { createInvitation } from '@corates/workers/commands/invitations';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireProjectAccess } from '@/server/guards/requireProjectAccess';
import { requireOrgWriteAccess } from '@/server/guards/requireOrgWriteAccess';
import { dbMiddleware } from '@/server/middleware/db';

type HandlerArgs = {
  request: Request;
  params: { orgId: OrgId; projectId: ProjectId };
  context: { db: Database };
};

export const handleGet = async ({ request, params, context: { db } }: HandlerArgs) => {
  const orgMembership = await requireOrgMembership(request, env, db, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const access = await requireProjectAccess(request, env, db, params.orgId, params.projectId);
  if (!access.ok) return access.response;

  try {
    const invitations = await db
      .select({
        id: projectInvitations.id,
        email: projectInvitations.email,
        role: projectInvitations.role,
        orgRole: projectInvitations.orgRole,
        expiresAt: projectInvitations.expiresAt,
        acceptedAt: projectInvitations.acceptedAt,
        createdAt: projectInvitations.createdAt,
        invitedBy: projectInvitations.invitedBy,
      })
      .from(projectInvitations)
      .where(
        and(
          eq(projectInvitations.projectId, params.projectId),
          isNull(projectInvitations.acceptedAt),
        ),
      )
      .orderBy(desc(projectInvitations.createdAt));

    return Response.json(invitations, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error listing invitations:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'list_invitations',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const handlePost = async ({ request, params, context: { db } }: HandlerArgs) => {
  const orgMembership = await requireOrgMembership(request, env, db, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const writeAccess = await requireOrgWriteAccess(request.method, db, params.orgId);
  if (!writeAccess.ok) return writeAccess.response;

  const access = await requireProjectAccess(
    request,
    env,
    db,
    params.orgId,
    params.projectId,
    'owner',
  );
  if (!access.ok) return access.response;

  let body: { email?: unknown; role?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    const error = createValidationError('body', VALIDATION_ERRORS.INVALID_INPUT.code, null);
    error.message = 'Invalid JSON input';
    return Response.json(error, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email : undefined;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(
      createValidationError(
        'email',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        email ?? null,
        'invalid_email',
      ),
      { status: 400 },
    );
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
    const result = await createInvitation(
      env,
      { id: access.context.userId },
      { orgId: params.orgId, projectId: params.projectId, email, role: roleInput },
    );

    return Response.json(
      {
        success: true,
        invitationId: result.invitationId,
        message:
          result.emailQueued ?
            'Invitation sent successfully'
          : 'Invitation created but email delivery may be delayed',
        email,
      },
      { status: 201 },
    );
  } catch (err) {
    if (isDomainError(err)) {
      return Response.json(err, { status: (err as DomainError).statusCode });
    }
    const error = err as Error;
    console.error('Error creating invitation:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'create_invitation',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/orgs/$orgId/projects/$projectId/invitations')({
  server: {
    middleware: [dbMiddleware],
    handlers: {
      GET: handleGet,
      POST: handlePost,
    },
  },
});
