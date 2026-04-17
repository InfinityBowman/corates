/**
 * Org-scoped project member routes for Hono
 * Routes: /api/orgs/:orgId/projects/:projectId/members
 */

import { OpenAPIHono, createRoute, z, $ } from '@hono/zod-openapi';
import { runMiddleware } from '@/lib/runMiddleware.js';
import { createDb } from '@corates/db/client';
import { projectMembers, user } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import {
  requireOrgMembership,
  requireProjectAccess,
  getOrgContext,
  getProjectContext,
} from '@/middleware/requireOrg.js';
import { requireOrgWriteAccess } from '@/middleware/requireOrgWriteAccess.js';
import {
  createDomainError,
  isDomainError,
  SYSTEM_ERRORS,
  USER_ERRORS,
  type DomainError,
} from '@corates/shared';
import { validationHook } from '@/lib/honoValidationHook.js';
import { addMember, updateMemberRole, removeMember } from '@/commands/members/index.js';
import { createInvitation } from '@/commands/invitations/index.js';
import { requireMemberRemoval } from '@/policies';
import type { Env } from '../../types';
import { ErrorResponseSchema } from '@/schemas/common.js';

const base = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

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
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - not a project member',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
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
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - not a project owner',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Member already exists',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
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
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - not a project owner',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
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
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - not a project owner and not self',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Member not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

/**
 * GET /api/orgs/:orgId/projects/:projectId/members
 * List all members of a project
 */
const orgProjectMemberRoutes = $(base.use('*', requireAuth))
  .openapi(listMembersRoute, async c => {
    const membershipResponse = await runMiddleware(requireOrgMembership(), c);
    if (membershipResponse) return membershipResponse as never;

    const projectAccessResponse = await runMiddleware(requireProjectAccess(), c);
    if (projectAccessResponse) return projectAccessResponse as never;

    const { projectId } = getProjectContext(c);
    if (!projectId) {
      const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'list_project_members',
        originalError: 'Missing project context',
      });
      return c.json(error, 500);
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

      return c.json(results as z.infer<typeof ProjectMemberListSchema>, 200);
    } catch (err) {
      const error = err as Error;
      console.error('Error listing project members:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'list_project_members',
        originalError: error.message,
      });
      return c.json(dbError, 500);
    }
  })

  /**
   * POST /api/orgs/:orgId/projects/:projectId/members
   * Add a member to the project (project owner only)
   */
  .openapi(addMemberRoute, async c => {
    const membershipResponse = await runMiddleware(requireOrgMembership(), c);
    if (membershipResponse) return membershipResponse as never;

    const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
    if (writeAccessResponse) return writeAccessResponse as never;

    const projectAccessResponse = await runMiddleware(requireProjectAccess('owner'), c);
    if (projectAccessResponse) return projectAccessResponse as never;

    const { orgId } = getOrgContext(c);
    const { projectId } = getProjectContext(c);
    if (!orgId || !projectId) {
      const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'add_project_member',
        originalError: 'Missing org or project context',
      });
      return c.json(error, 500);
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
        const { user: authUser } = getAuth(c);
        if (!authUser) {
          const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
            operation: 'handle_invitation',
            originalError: 'Missing auth user',
          });
          return c.json(error, 500);
        }

        try {
          const result = await createInvitation(
            c.env,
            { id: authUser.id },
            {
              orgId,
              projectId,
              email,
              role,
            },
          );

          return c.json(
            {
              success: true,
              invitation: true,
              message:
                result.emailQueued ?
                  'Invitation sent successfully'
                : 'Invitation created but email delivery may be delayed',
              email,
            },
            201,
          ) as never;
        } catch (err) {
          if (isDomainError(err)) {
            return c.json(err, 409) as never;
          }
          throw err;
        }
      }

      if (!userToAdd) {
        const error = createDomainError(USER_ERRORS.NOT_FOUND, { userId, email });
        return c.json(error, 404);
      }

      const { user: authUser } = getAuth(c);
      if (!authUser) {
        const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
          operation: 'add_project_member',
          originalError: 'Missing auth user',
        });
        return c.json(error, 500);
      }

      const { member: addedMember } = await addMember(c.env, authUser, {
        orgId,
        projectId,
        userToAdd,
        role,
      });

      return c.json(addedMember as z.infer<typeof MemberAddedSchema>, 201);
    } catch (err) {
      if (isDomainError(err)) {
        return c.json(err, (err as DomainError).statusCode as 400 | 401 | 403 | 404 | 409 | 500);
      }
      const error = err as Error;
      console.error('Error adding project member:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'add_project_member',
        originalError: error.message,
      });
      return c.json(dbError, 500);
    }
  })

  /**
   * PUT /api/orgs/:orgId/projects/:projectId/members/:userId
   * Update a member's role (project owner only)
   */
  .openapi(updateMemberRoleRoute, async c => {
    const membershipResponse = await runMiddleware(requireOrgMembership(), c);
    if (membershipResponse) return membershipResponse as never;

    const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
    if (writeAccessResponse) return writeAccessResponse as never;

    const projectAccessResponse = await runMiddleware(requireProjectAccess('owner'), c);
    if (projectAccessResponse) return projectAccessResponse as never;

    const { orgId } = getOrgContext(c);
    const { projectId } = getProjectContext(c);
    if (!orgId || !projectId) {
      const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'update_project_member_role',
        originalError: 'Missing org or project context',
      });
      return c.json(error, 500);
    }

    const { user: authUser } = getAuth(c);
    if (!authUser) {
      const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'update_project_member_role',
        originalError: 'Missing auth user',
      });
      return c.json(error, 500);
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

      return c.json({ success: true, userId: result.userId, role: result.role }, 200);
    } catch (err) {
      if (isDomainError(err)) {
        return c.json(err, 400);
      }
      const error = err as Error;
      console.error('Error updating project member role:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'update_project_member_role',
        originalError: error.message,
      });
      return c.json(dbError, 500);
    }
  })

  /**
   * DELETE /api/orgs/:orgId/projects/:projectId/members/:userId
   * Remove a member from the project (project owner only, or self-removal)
   */
  .openapi(removeMemberRoute, async c => {
    const membershipResponse = await runMiddleware(requireOrgMembership(), c);
    if (membershipResponse) return membershipResponse as never;

    const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
    if (writeAccessResponse) return writeAccessResponse as never;

    const projectAccessResponse = await runMiddleware(requireProjectAccess(), c);
    if (projectAccessResponse) return projectAccessResponse as never;

    const { user: authUser } = getAuth(c);
    const { orgId } = getOrgContext(c);
    const { projectId } = getProjectContext(c);

    if (!authUser || !orgId || !projectId) {
      const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'remove_project_member',
        originalError: 'Missing context',
      });
      return c.json(error, 500);
    }

    const { userId: memberId } = c.req.valid('param');
    const db = createDb(c.env.DB);

    const isSelf = memberId === authUser.id;

    try {
      await requireMemberRemoval(db, authUser.id, projectId, memberId);
    } catch (err) {
      if (isDomainError(err)) {
        return c.json(err, (err as DomainError).statusCode as 400 | 401 | 403 | 404 | 500);
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

      return c.json({ success: true, removed: result.removed }, 200);
    } catch (err) {
      if (isDomainError(err)) {
        return c.json(err, (err as DomainError).statusCode as 400 | 401 | 403 | 404 | 500);
      }
      const error = err as Error;
      console.error('Error removing project member:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'remove_project_member',
        originalError: error.message,
      });
      return c.json(dbError, 500);
    }
  });

export { orgProjectMemberRoutes };
