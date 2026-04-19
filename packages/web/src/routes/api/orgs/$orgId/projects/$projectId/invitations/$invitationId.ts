import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import { projectInvitations } from '@corates/db/schema';
import { and, eq } from 'drizzle-orm';
import {
  createDomainError,
  PROJECT_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import type { OrgId, ProjectId, ProjectInvitationId } from '@corates/shared/ids';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireProjectAccess } from '@/server/guards/requireProjectAccess';
import { requireOrgWriteAccess } from '@/server/guards/requireOrgWriteAccess';
import { dbMiddleware } from '@/server/middleware/db';

type HandlerArgs = {
  request: Request;
  params: { orgId: OrgId; projectId: ProjectId; invitationId: ProjectInvitationId };
  context: { db: Database };
};

export const handleDelete = async ({ request, params, context: { db } }: HandlerArgs) => {
  const orgMembership = await requireOrgMembership(request, env, db, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const writeAccess = await requireOrgWriteAccess(request.method, db, params.orgId);
  if (!writeAccess.ok) return writeAccess.response;

  const access = await requireProjectAccess(request, env, db, params.orgId, params.projectId, 'owner');
  if (!access.ok) return access.response;

  try {
    const invitation = await db
      .select({ acceptedAt: projectInvitations.acceptedAt })
      .from(projectInvitations)
      .where(
        and(
          eq(projectInvitations.id, params.invitationId),
          eq(projectInvitations.projectId, params.projectId),
        ),
      )
      .get();

    if (!invitation) {
      return Response.json(
        createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
          field: 'invitationId',
          value: params.invitationId,
        }),
        { status: 400 },
      );
    }

    if (invitation.acceptedAt) {
      return Response.json(
        createDomainError(PROJECT_ERRORS.INVITATION_ALREADY_ACCEPTED, {
          invitationId: params.invitationId,
        }),
        { status: PROJECT_ERRORS.INVITATION_ALREADY_ACCEPTED.statusCode },
      );
    }

    await db.delete(projectInvitations).where(eq(projectInvitations.id, params.invitationId));

    return Response.json({ success: true, cancelled: params.invitationId }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error cancelling invitation:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'cancel_invitation',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute(
  '/api/orgs/$orgId/projects/$projectId/invitations/$invitationId',
)({
  server: {
    middleware: [dbMiddleware],
    handlers: {
      DELETE: handleDelete,
    },
  },
});
