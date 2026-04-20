import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import { projectMembers, user } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  isDomainError,
  SYSTEM_ERRORS,
  USER_ERRORS,
  VALIDATION_ERRORS,
  type DomainError,
} from '@corates/shared';
import type { OrgId, ProjectId } from '@corates/shared/ids';
import { addMember } from '@corates/workers/commands/members';
import { createInvitation } from '@corates/workers/commands/invitations';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireProjectAccess } from '@/server/guards/requireProjectAccess';
import { requireOrgWriteAccess } from '@/server/guards/requireOrgWriteAccess';
import { authMiddleware, type Session } from '@/server/middleware/auth';

type HandlerArgs = {
  request: Request;
  params: { orgId: OrgId; projectId: ProjectId };
  context: { db: Database; session: Session };
};

export const handleGet = async ({ params, context: { db, session } }: HandlerArgs) => {
  const orgMembership = await requireOrgMembership(session, db, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const access = await requireProjectAccess(session, db, params.orgId, params.projectId);
  if (!access.ok) return access.response;

  try {
    const results = await db
      .select({
        userId: projectMembers.userId,
        role: projectMembers.role,
        joinedAt: projectMembers.joinedAt,
        name: user.name,
        email: user.email,
        username: user.username,
        givenName: user.givenName,
        familyName: user.familyName,
        image: user.image,
      })
      .from(projectMembers)
      .innerJoin(user, eq(projectMembers.userId, user.id))
      .where(eq(projectMembers.projectId, params.projectId))
      .orderBy(projectMembers.joinedAt);

    return Response.json(results, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error listing project members:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'list_project_members',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const handlePost = async ({ request, params, context: { db, session } }: HandlerArgs) => {
  const orgMembership = await requireOrgMembership(session, db, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const writeAccess = await requireOrgWriteAccess(request.method, db, params.orgId);
  if (!writeAccess.ok) return writeAccess.response;

  const access = await requireProjectAccess(session, db, params.orgId, params.projectId, 'owner');
  if (!access.ok) return access.response;

  let body: { userId?: unknown; email?: unknown; role?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    const error = createValidationError('body', VALIDATION_ERRORS.INVALID_INPUT.code, null);
    error.message = 'Invalid JSON input';
    return Response.json(error, { status: 400 });
  }

  const userId = typeof body.userId === 'string' ? body.userId : undefined;
  const email = typeof body.email === 'string' ? body.email : undefined;
  const roleInput = typeof body.role === 'string' ? body.role : 'member';
  if (roleInput !== 'owner' && roleInput !== 'member') {
    return Response.json(
      createValidationError(
        'role',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        roleInput,
        'invalid_enum',
      ),
      { status: 400 },
    );
  }
  const role = roleInput as 'owner' | 'member';

  if (!userId && !email) {
    return Response.json(
      createValidationError(
        'userId/email',
        VALIDATION_ERRORS.FIELD_REQUIRED.code,
        null,
        'userId_or_email_required',
      ),
      { status: 400 },
    );
  }

  try {
    let userToAdd;
    if (userId) {
      userToAdd = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          givenName: user.givenName,
          familyName: user.familyName,
          image: user.image,
        })
        .from(user)
        .where(eq(user.id, userId))
        .get();
    } else if (email) {
      userToAdd = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          givenName: user.givenName,
          familyName: user.familyName,
          image: user.image,
        })
        .from(user)
        .where(eq(user.email, email.toLowerCase()))
        .get();
    }

    if (!userToAdd && email) {
      try {
        const result = await createInvitation(
          env,
          { id: access.context.userId },
          { orgId: params.orgId, projectId: params.projectId, email, role },
        );
        return Response.json(
          {
            success: true,
            invitation: true,
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
          return Response.json(err, { status: 409 });
        }
        throw err;
      }
    }

    if (!userToAdd) {
      return Response.json(createDomainError(USER_ERRORS.NOT_FOUND, { userId, email }), {
        status: 404,
      });
    }

    const { member: addedMember } = await addMember(
      env,
      { id: access.context.userId },
      { orgId: params.orgId, projectId: params.projectId, userToAdd, role },
    );

    return Response.json(addedMember, { status: 201 });
  } catch (err) {
    if (isDomainError(err)) {
      return Response.json(err, { status: (err as DomainError).statusCode });
    }
    const error = err as Error;
    console.error('Error adding project member:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'add_project_member',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/orgs/$orgId/projects/$projectId/members')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: handleGet,
      POST: handlePost,
    },
  },
});
