/**
 * Org-scoped project member routes for Hono
 * Routes: /api/orgs/:orgId/projects/:projectId/members
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Context, MiddlewareHandler } from 'hono';
import { createDb } from '@/db/client.js';
import { projectMembers, user, projects, projectInvitations } from '@/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import {
  requireOrgMembership,
  requireProjectAccess,
  getOrgContext,
  getProjectContext,
} from '@/middleware/requireOrg.js';
import { requireOrgWriteAccess } from '@/middleware/requireOrgWriteAccess.js';
import { TIME_DURATIONS } from '@/config/constants.js';
import {
  createDomainError,
  isDomainError,
  SYSTEM_ERRORS,
  USER_ERRORS,
  PROJECT_ERRORS,
} from '@corates/shared';
import { validationHook } from '@/lib/honoValidationHook.js';
import { addMember, updateMemberRole, removeMember } from '@/commands/members/index.js';
import { requireMemberRemoval } from '@/policies';
import type { Env } from '../../types';

const orgProjectMemberRoutes = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

// Apply auth middleware to all routes
orgProjectMemberRoutes.use('*', requireAuth);

// Request/Response schemas
const ProjectMemberSchema = z
  .object({
    userId: z.string(),
    role: z.string(),
    joinedAt: z.union([z.string(), z.date(), z.number()]),
    name: z.string(),
    email: z.string(),
    username: z.string().nullable(),
    givenName: z.string().nullable(),
    familyName: z.string().nullable(),
    image: z.string().nullable(),
  })
  .openapi('ProjectMember');

const ProjectMemberListSchema = z.array(ProjectMemberSchema).openapi('ProjectMemberList');

const AddMemberRequestSchema = z
  .object({
    userId: z.string().min(1, 'Invalid user ID').optional().openapi({ example: 'user-123' }),
    email: z
      .string()
      .email('Invalid email address')
      .optional()
      .openapi({ example: 'user@example.com' }),
    role: z
      .enum(['owner', 'member'], { message: 'Role must be one of: owner, member' })
      .default('member')
      .openapi({ example: 'member' }),
  })
  .refine(data => data.userId || data.email, {
    message: 'Either userId or email is required',
  })
  .openapi('AddMemberRequest');

const UpdateMemberRoleRequestSchema = z
  .object({
    role: z
      .enum(['owner', 'member'], { message: 'Role must be one of: owner, member' })
      .openapi({ example: 'owner' }),
  })
  .openapi('UpdateMemberRoleRequest');

const MemberErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('MemberError');

const MemberAddedSchema = z
  .object({
    userId: z.string(),
    name: z.string(),
    email: z.string(),
    username: z.string().nullable(),
    givenName: z.string().nullable(),
    familyName: z.string().nullable(),
    image: z.string().nullable(),
    role: z.string(),
    joinedAt: z.union([z.string(), z.date()]),
  })
  .openapi('MemberAdded');

const InvitationSentSchema = z
  .object({
    success: z.boolean(),
    invitation: z.boolean(),
    message: z.string(),
    email: z.string(),
  })
  .openapi('InvitationSent');

const MemberUpdatedSchema = z
  .object({
    success: z.boolean(),
    userId: z.string(),
    role: z.string(),
  })
  .openapi('MemberUpdated');

const MemberRemovedSchema = z
  .object({
    success: z.boolean(),
    removed: z.string(),
  })
  .openapi('MemberRemoved');

// Route definitions
const listMembersRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Project Members'],
  summary: 'List project members',
  description: 'List all members of a project',
  responses: {
    200: {
      description: 'List of project members',
      content: {
        'application/json': {
          schema: ProjectMemberListSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - not a project member',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
  },
});

const addMemberRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Project Members'],
  summary: 'Add a project member',
  description:
    'Add a member to the project (project owner only). If user does not exist and email is provided, sends an invitation.',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: AddMemberRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Member added or invitation sent',
      content: {
        'application/json': {
          schema: z.union([MemberAddedSchema, InvitationSentSchema]),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - not a project owner',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
    409: {
      description: 'Member already exists',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
  },
});

const updateMemberRoleRoute = createRoute({
  method: 'put',
  path: '/{userId}',
  tags: ['Project Members'],
  summary: 'Update member role',
  description: "Update a member's role in the project (project owner only)",
  request: {
    params: z.object({
      userId: z.string().openapi({ description: 'User ID to update', example: 'user-123' }),
    }),
    body: {
      required: true,
      content: {
        'application/json': {
          schema: UpdateMemberRoleRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Role updated successfully',
      content: {
        'application/json': {
          schema: MemberUpdatedSchema,
        },
      },
    },
    400: {
      description: 'Validation error or last owner',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - not a project owner',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
  },
});

const removeMemberRoute = createRoute({
  method: 'delete',
  path: '/{userId}',
  tags: ['Project Members'],
  summary: 'Remove project member',
  description: 'Remove a member from the project (project owner only, or self-removal)',
  request: {
    params: z.object({
      userId: z.string().openapi({ description: 'User ID to remove', example: 'user-123' }),
    }),
  },
  responses: {
    200: {
      description: 'Member removed successfully',
      content: {
        'application/json': {
          schema: MemberRemovedSchema,
        },
      },
    },
    400: {
      description: 'Cannot remove last owner',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - not a project owner and not self',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
    404: {
      description: 'Member not found',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: MemberErrorSchema,
        },
      },
    },
  },
});

/**
 * Helper to run middleware manually and check for early response
 */
async function runMiddleware(middleware: MiddlewareHandler, c: Context): Promise<Response | null> {
  let nextCalled = false;

  const result = await middleware(c, async () => {
    nextCalled = true;
  });

  if (result instanceof Response) {
    return result;
  }

  if (!nextCalled && c.res) {
    return c.res;
  }

  return null;
}

/**
 * GET /api/orgs/:orgId/projects/:projectId/members
 * List all members of a project
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
orgProjectMemberRoutes.openapi(listMembersRoute, async c => {
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  const projectAccessResponse = await runMiddleware(requireProjectAccess(), c);
  if (projectAccessResponse) return projectAccessResponse;

  const { projectId } = getProjectContext(c);
  if (!projectId) {
    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'list_project_members',
      originalError: 'Missing project context',
    });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

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
    console.error('Error listing project members:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'list_project_members',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * POST /api/orgs/:orgId/projects/:projectId/members
 * Add a member to the project (project owner only)
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
orgProjectMemberRoutes.openapi(addMemberRoute, async c => {
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
  if (writeAccessResponse) return writeAccessResponse;

  const projectAccessResponse = await runMiddleware(requireProjectAccess('owner'), c);
  if (projectAccessResponse) return projectAccessResponse;

  const { orgId } = getOrgContext(c);
  const { projectId } = getProjectContext(c);
  if (!orgId || !projectId) {
    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'add_project_member',
      originalError: 'Missing org or project context',
    });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

  const db = createDb(c.env.DB);
  const body = c.req.valid('json');
  const { userId, email, role } = body;

  try {
    // Find user by userId or email
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

    // If user doesn't exist and email was provided, create an invitation
    if (!userToAdd && email) {
      return await handleInvitation(c, { orgId, projectId, email, role });
    }

    if (!userToAdd) {
      const error = createDomainError(USER_ERRORS.NOT_FOUND, { userId, email });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    const { user: authUser } = getAuth(c);
    if (!authUser) {
      const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'add_project_member',
        originalError: 'Missing auth user',
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    const { member: addedMember } = await addMember(c.env, authUser, {
      orgId,
      projectId,
      userToAdd,
      role,
    });

    return c.json(addedMember, 201);
  } catch (err) {
    if (isDomainError(err)) {
      return c.json(err, err.statusCode as ContentfulStatusCode);
    }
    const error = err as Error;
    console.error('Error adding project member:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'add_project_member',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * PUT /api/orgs/:orgId/projects/:projectId/members/:userId
 * Update a member's role (project owner only)
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
orgProjectMemberRoutes.openapi(updateMemberRoleRoute, async c => {
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
  if (writeAccessResponse) return writeAccessResponse;

  const projectAccessResponse = await runMiddleware(requireProjectAccess('owner'), c);
  if (projectAccessResponse) return projectAccessResponse;

  const { orgId } = getOrgContext(c);
  const { projectId } = getProjectContext(c);
  if (!orgId || !projectId) {
    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_project_member_role',
      originalError: 'Missing org or project context',
    });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

  const { user: authUser } = getAuth(c);
  if (!authUser) {
    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_project_member_role',
      originalError: 'Missing auth user',
    });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

  const { userId: memberId } = c.req.valid('param');
  const { role } = c.req.valid('json');

  try {
    const result = await updateMemberRole(c.env, authUser, {
      orgId,
      projectId,
      userId: memberId,
      role,
    });

    return c.json({ success: true, userId: result.userId, role: result.role });
  } catch (err) {
    if (isDomainError(err)) {
      return c.json(err, err.statusCode as ContentfulStatusCode);
    }
    const error = err as Error;
    console.error('Error updating project member role:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_project_member_role',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * DELETE /api/orgs/:orgId/projects/:projectId/members/:userId
 * Remove a member from the project (project owner only, or self-removal)
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
orgProjectMemberRoutes.openapi(removeMemberRoute, async c => {
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
  if (writeAccessResponse) return writeAccessResponse;

  const projectAccessResponse = await runMiddleware(requireProjectAccess(), c);
  if (projectAccessResponse) return projectAccessResponse;

  const { user: authUser } = getAuth(c);
  const { orgId } = getOrgContext(c);
  const { projectId } = getProjectContext(c);

  if (!authUser || !orgId || !projectId) {
    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'remove_project_member',
      originalError: 'Missing context',
    });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

  const { userId: memberId } = c.req.valid('param');
  const db = createDb(c.env.DB);

  const isSelf = memberId === authUser.id;

  try {
    await requireMemberRemoval(db, authUser.id, projectId, memberId);
  } catch (err) {
    if (isDomainError(err)) {
      return c.json(err, err.statusCode as ContentfulStatusCode);
    }
    throw err;
  }

  try {
    const result = await removeMember(c.env, authUser, {
      orgId,
      projectId,
      userId: memberId,
      isSelfRemoval: isSelf,
    });

    return c.json({ success: true, removed: result.removed });
  } catch (err) {
    if (isDomainError(err)) {
      return c.json(err, err.statusCode as ContentfulStatusCode);
    }
    const error = err as Error;
    console.error('Error removing project member:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'remove_project_member',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

interface InvitationParams {
  orgId: string;
  projectId: string;
  email: string;
  role: string;
}

/**
 * Handle invitation for users who don't have accounts yet
 */
async function handleInvitation(
  c: Context<{ Bindings: Env }>,
  { orgId, projectId, email, role }: InvitationParams,
): Promise<Response> {
  const { user: authUser } = getAuth(c);
  if (!authUser) {
    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'handle_invitation',
      originalError: 'Missing auth user',
    });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

  const db = createDb(c.env.DB);

  // Check for existing pending invitation
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
    // Resend existing invitation
    invitationId = existingInvitation.id;
    token = existingInvitation.token;
    const expiresAt = new Date(Date.now() + TIME_DURATIONS.INVITATION_EXPIRY_MS);

    await db
      .update(projectInvitations)
      .set({ role, expiresAt })
      .where(eq(projectInvitations.id, existingInvitation.id));
  } else if (existingInvitation && existingInvitation.acceptedAt) {
    const error = createDomainError(PROJECT_ERRORS.INVITATION_ALREADY_ACCEPTED, {
      invitationId: existingInvitation.id,
    });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  } else {
    // Create new invitation with orgId
    invitationId = crypto.randomUUID();
    token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + TIME_DURATIONS.INVITATION_EXPIRY_MS);

    await db.insert(projectInvitations).values({
      id: invitationId,
      orgId,
      projectId,
      email: email.toLowerCase(),
      role,
      orgRole: 'member',
      token,
      invitedBy: authUser.id,
      expiresAt,
      createdAt: new Date(),
    });
  }

  // Get project and inviter info for email
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

  // Send invitation email
  const projectName = project?.name || 'Unknown Project';
  const inviterName = inviter?.givenName || inviter?.name || inviter?.email || 'Someone';

  let emailQueued = false;
  try {
    const { sendInvitationEmail } = await import('@/lib/send-invitation-email.js');
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
      success: true,
      invitation: true,
      message: emailQueued ? 'Invitation sent successfully' : 'Invitation created but email delivery may be delayed',
      email,
    },
    201,
  );
}

export { orgProjectMemberRoutes };
