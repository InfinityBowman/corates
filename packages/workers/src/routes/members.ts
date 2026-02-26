/**
 * Project member routes for Hono
 * Handles project membership management
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { createDb } from '@/db/client';
import { projectMembers, user, projects, projectInvitations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth, getAuth } from '@/middleware/auth';
import { TIME_DURATIONS } from '@/config/constants';
import {
  createDomainError,
  isDomainError,
  AUTH_ERRORS,
  PROJECT_ERRORS,
  SYSTEM_ERRORS,
  USER_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { syncMemberToDO } from '@/lib/project-sync';
import { validationHook } from '@/lib/honoValidationHook';
import {
  getProjectMembership,
  requireMemberManagement,
  requireMemberRemoval,
  requireSafeRoleChange,
  requireSafeRemoval,
  isProjectOwner,
} from '@/policies';
import type { Env } from '../types';
import type { Context, Next } from 'hono';

interface MemberContext {
  projectId: string;
  membership: { role: string };
  isOwner: boolean;
}

const memberRoutes = new OpenAPIHono<{ Bindings: Env; Variables: MemberContext }>({
  defaultHook: validationHook,
});

// Apply auth middleware to all routes
memberRoutes.use('*', requireAuth);

/**
 * Middleware to verify project membership and set context
 */
async function projectMembershipMiddleware(
  c: Context<{ Bindings: Env; Variables: MemberContext }>,
  next: Next,
): Promise<Response | void> {
  const { user: authUser } = getAuth(c);
  const projectId = c.req.param('projectId');

  if (!projectId) {
    const error = createDomainError(
      VALIDATION_ERRORS.FIELD_REQUIRED,
      { field: 'projectId' },
      'Project ID required',
    );
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

  if (!authUser) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

  const db = createDb(c.env.DB);
  const membership = await getProjectMembership(db, authUser.id, projectId);

  if (!membership || !membership.role) {
    const error = createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

  c.set('projectId', projectId);
  c.set('membership', { role: membership.role });
  c.set('isOwner', isProjectOwner(membership.role));

  await next();
}

// Apply project membership middleware to all routes
memberRoutes.use('*', projectMembershipMiddleware);

// Request schemas
const AddMemberRequestSchema = z
  .object({
    userId: z.string().optional().openapi({ example: 'user-123' }),
    email: z.string().email().optional().openapi({ example: 'user@example.com' }),
    role: z.enum(['owner', 'member']).default('member').openapi({ example: 'member' }),
  })
  .openapi('AddMemberRequest');

const UpdateRoleRequestSchema = z
  .object({
    role: z.enum(['owner', 'member']).openapi({ example: 'member' }),
  })
  .openapi('UpdateRoleRequest');

// Response schemas
const MemberSchema = z
  .object({
    userId: z.string(),
    role: z.string(),
    joinedAt: z.string().or(z.date()),
    name: z.string().nullable(),
    email: z.string(),
    username: z.string().nullable(),
    givenName: z.string().nullable(),
    familyName: z.string().nullable(),
    image: z.string().nullable(),
  })
  .openapi('Member');

const MemberListSchema = z.array(MemberSchema).openapi('MemberList');

const AddMemberSuccessSchema = z
  .object({
    userId: z.string(),
    name: z.string().nullable(),
    email: z.string(),
    username: z.string().nullable(),
    givenName: z.string().nullable(),
    familyName: z.string().nullable(),
    image: z.string().nullable(),
    role: z.string(),
    joinedAt: z.string().or(z.date()),
  })
  .openapi('AddMemberSuccess');

const InvitationSentSchema = z
  .object({
    success: z.literal(true),
    invitation: z.literal(true),
    message: z.string(),
    email: z.string(),
  })
  .openapi('InvitationSent');

const UpdateRoleSuccessSchema = z
  .object({
    success: z.literal(true),
    userId: z.string(),
    role: z.string(),
  })
  .openapi('UpdateRoleSuccess');

const RemoveMemberSuccessSchema = z
  .object({
    success: z.literal(true),
    removed: z.string(),
  })
  .openapi('RemoveMemberSuccess');

const MemberErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('MemberError');

// Route definitions
const listMembersRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Project Members'],
  summary: 'List project members',
  description: 'List all members of a project',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: MemberListSchema } },
      description: 'List of members',
    },
    403: {
      content: { 'application/json': { schema: MemberErrorSchema } },
      description: 'Access denied',
    },
    500: {
      content: { 'application/json': { schema: MemberErrorSchema } },
      description: 'Database error',
    },
  },
});

const addMemberRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Project Members'],
  summary: 'Add project member',
  description: 'Add a member to the project (owner only)',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: AddMemberRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.union([AddMemberSuccessSchema, InvitationSentSchema]),
        },
      },
      description: 'Member added or invitation sent',
    },
    400: {
      content: { 'application/json': { schema: MemberErrorSchema } },
      description: 'Validation error',
    },
    403: {
      content: { 'application/json': { schema: MemberErrorSchema } },
      description: 'Not authorized',
    },
    404: {
      content: { 'application/json': { schema: MemberErrorSchema } },
      description: 'User not found',
    },
    409: {
      content: { 'application/json': { schema: MemberErrorSchema } },
      description: 'Member already exists',
    },
  },
});

const updateRoleRoute = createRoute({
  method: 'put',
  path: '/:userId',
  tags: ['Project Members'],
  summary: 'Update member role',
  description: "Update a member's role (owner only)",
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      userId: z.string().openapi({ example: 'user-123' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateRoleRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: UpdateRoleSuccessSchema } },
      description: 'Role updated',
    },
    400: {
      content: { 'application/json': { schema: MemberErrorSchema } },
      description: 'Validation error',
    },
    403: {
      content: { 'application/json': { schema: MemberErrorSchema } },
      description: 'Not authorized or last owner',
    },
  },
});

const removeMemberRoute = createRoute({
  method: 'delete',
  path: '/:userId',
  tags: ['Project Members'],
  summary: 'Remove project member',
  description: 'Remove a member from the project (owner only, or self-removal)',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      userId: z.string().openapi({ example: 'user-123' }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: RemoveMemberSuccessSchema } },
      description: 'Member removed',
    },
    403: {
      content: { 'application/json': { schema: MemberErrorSchema } },
      description: 'Not authorized or last owner',
    },
    404: {
      content: { 'application/json': { schema: MemberErrorSchema } },
      description: 'Member not found',
    },
  },
});

// Route handlers
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
memberRoutes.openapi(listMembersRoute, async c => {
  const projectId = c.get('projectId');
  const db = createDb(c.env.DB);

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
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(projectMembers.joinedAt);

    return c.json(results);
  } catch (err) {
    const error = err as Error;
    console.error('Error listing members:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'list_members',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
memberRoutes.openapi(addMemberRoute, async c => {
  const projectId = c.get('projectId');
  const db = createDb(c.env.DB);
  const { userId, email, role } = c.req.valid('json');
  const { user: authUser } = getAuth(c);

  if (!authUser) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

  try {
    await requireMemberManagement(db, authUser.id, projectId);
  } catch (err) {
    if (isDomainError(err)) {
      return c.json(err, err.statusCode as ContentfulStatusCode);
    }
    throw err;
  }

  try {
    let userToAdd:
      | {
          id: string;
          name: string | null;
          email: string;
          username: string | null;
          givenName: string | null;
          familyName: string | null;
          image: string | null;
        }
      | undefined;

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
      const existingInvitation = await db
        .select({
          id: projectInvitations.id,
          token: projectInvitations.token,
          acceptedAt: projectInvitations.acceptedAt,
        })
        .from(projectInvitations)
        .where(
          and(
            eq(projectInvitations.projectId, projectId),
            eq(projectInvitations.email, email.toLowerCase()),
          ),
        )
        .get();

      let token: string;
      let invitationId: string;

      if (existingInvitation && !existingInvitation.acceptedAt) {
        invitationId = existingInvitation.id;
        token = existingInvitation.token;
        const expiresAt = new Date(Date.now() + TIME_DURATIONS.INVITATION_EXPIRY_MS);

        await db
          .update(projectInvitations)
          .set({
            role,
            expiresAt,
          })
          .where(eq(projectInvitations.id, existingInvitation.id));
      } else if (existingInvitation && existingInvitation.acceptedAt) {
        const error = createDomainError(PROJECT_ERRORS.INVITATION_ALREADY_ACCEPTED, {
          invitationId: existingInvitation.id,
        });
        return c.json(error, error.statusCode as ContentfulStatusCode);
      } else {
        invitationId = crypto.randomUUID();
        token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + TIME_DURATIONS.INVITATION_EXPIRY_MS);

        // Fetch project's orgId for the invitation
        const projectForInvite = await db
          .select({ orgId: projects.orgId })
          .from(projects)
          .where(eq(projects.id, projectId))
          .get();

        if (!projectForInvite) {
          const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
          return c.json(error, error.statusCode as ContentfulStatusCode);
        }

        await db.insert(projectInvitations).values({
          id: invitationId,
          projectId,
          orgId: projectForInvite.orgId,
          email: email.toLowerCase(),
          role,
          token,
          invitedBy: authUser.id,
          expiresAt,
          createdAt: new Date(),
        });
      }

      const project = await db
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, projectId))
        .get();

      const inviter = await db
        .select({ name: user.name, givenName: user.givenName, email: user.email })
        .from(user)
        .where(eq(user.id, authUser.id))
        .get();

      const projectName = project?.name || 'Unknown Project';
      const inviterName = inviter?.givenName || inviter?.name || inviter?.email || 'Someone';

      let emailQueued = false;
      try {
        const { sendInvitationEmail } = await import('../lib/send-invitation-email');
        const result = await sendInvitationEmail({
          env: c.env,
          email,
          token,
          projectName,
          inviterName,
          role,
        });
        emailQueued = result.emailQueued;
      } catch (err) {
        console.error('[Invitation] Magic link generation failed:', err);
      }

      return c.json(
        {
          success: true as const,
          invitation: true as const,
          message:
            emailQueued ?
              'Invitation sent successfully'
            : 'Invitation created but email delivery may be delayed',
          email,
        },
        201,
      );
    }

    if (!userToAdd) {
      const error = createDomainError(USER_ERRORS.NOT_FOUND, { userId, email });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    const existingMember = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userToAdd.id)))
      .get();

    if (existingMember) {
      const error = createDomainError(PROJECT_ERRORS.MEMBER_ALREADY_EXISTS, {
        projectId,
        userId: userToAdd.id,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    const now = new Date();
    await db.insert(projectMembers).values({
      id: crypto.randomUUID(),
      projectId,
      userId: userToAdd.id,
      role,
      joinedAt: now,
    });

    const project = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    try {
      const userSessionId = c.env.USER_SESSION.idFromName(userToAdd.id);
      const userSession = c.env.USER_SESSION.get(userSessionId);
      await userSession.notify({
        type: 'project-invite',
        projectId,
        projectName: project?.name || 'Unknown Project',
        role,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('Failed to send project invite notification:', err);
    }

    try {
      await syncMemberToDO(c.env, projectId, 'add', {
        userId: userToAdd.id,
        role,
        joinedAt: now.getTime(),
        name: userToAdd.name,
        email: userToAdd.email,
        givenName: userToAdd.givenName,
        familyName: userToAdd.familyName,
        image: userToAdd.image,
      });
    } catch (err) {
      console.error('Failed to sync member to DO:', err);
    }

    return c.json(
      {
        userId: userToAdd.id,
        name: userToAdd.name,
        email: userToAdd.email,
        username: userToAdd.username,
        givenName: userToAdd.givenName,
        familyName: userToAdd.familyName,
        image: userToAdd.image,
        role,
        joinedAt: now,
      },
      201,
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error adding member:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'add_member',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
memberRoutes.openapi(updateRoleRoute, async c => {
  const projectId = c.get('projectId');
  const memberId = c.req.param('userId');
  const db = createDb(c.env.DB);
  const { role } = c.req.valid('json');
  const { user: authUser } = getAuth(c);

  if (!authUser) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

  try {
    await requireMemberManagement(db, authUser.id, projectId);
    await requireSafeRoleChange(db, projectId, memberId!, role);
  } catch (err) {
    if (isDomainError(err)) {
      return c.json(err, err.statusCode as ContentfulStatusCode);
    }
    throw err;
  }

  try {
    await db
      .update(projectMembers)
      .set({ role })
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberId!)));

    try {
      await syncMemberToDO(c.env, projectId, 'update', {
        userId: memberId!,
        role,
      });
    } catch (err) {
      console.error('Failed to sync member update to DO:', err);
    }

    return c.json({ success: true as const, userId: memberId!, role });
  } catch (err) {
    const error = err as Error;
    console.error('Error updating member role:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_member_role',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
memberRoutes.openapi(removeMemberRoute, async c => {
  const { user: authUser } = getAuth(c);
  const projectId = c.get('projectId');
  const memberId = c.req.param('userId');
  const db = createDb(c.env.DB);

  if (!authUser) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

  const isSelfRemoval = memberId === authUser.id;

  try {
    await requireMemberRemoval(db, authUser.id, projectId, memberId!);
    await requireSafeRemoval(db, projectId, memberId!);
  } catch (err) {
    if (isDomainError(err)) {
      return c.json(err, err.statusCode as ContentfulStatusCode);
    }
    throw err;
  }

  try {
    const targetMember = await getProjectMembership(db, memberId!, projectId);

    if (!targetMember) {
      const error = createDomainError(
        PROJECT_ERRORS.NOT_FOUND,
        { projectId, userId: memberId },
        'Member not found',
      );
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberId!)));

    try {
      await syncMemberToDO(c.env, projectId, 'remove', {
        userId: memberId!,
      });
    } catch (err) {
      console.error('Failed to sync member removal to DO:', err);
    }

    if (!isSelfRemoval) {
      try {
        const project = await db
          .select({ name: projects.name })
          .from(projects)
          .where(eq(projects.id, projectId))
          .get();

        const userSessionId = c.env.USER_SESSION.idFromName(memberId!);
        const userSession = c.env.USER_SESSION.get(userSessionId);
        await userSession.notify({
          type: 'removed-from-project',
          projectId,
          projectName: project?.name || 'Unknown Project',
          removedBy: authUser.name || authUser.email,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error('Failed to send removal notification:', err);
      }
    }

    return c.json({ success: true as const, removed: memberId! });
  } catch (err) {
    const error = err as Error;
    console.error('Error removing member:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'remove_member',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

export { memberRoutes };
