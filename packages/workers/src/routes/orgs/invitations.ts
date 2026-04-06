/**
 * Org-scoped project invitation routes for Hono
 * Routes: /api/orgs/:orgId/projects/:projectId/invitations
 *
 * Combined invite flow: accepting ensures org membership then project membership
 */

import { OpenAPIHono, createRoute, z, $ } from '@hono/zod-openapi';
import { runMiddleware } from '@/lib/runMiddleware.js';
import { createDb } from '@/db/client.js';
import { projectInvitations } from '@/db/schema.js';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import {
  requireOrgMembership,
  requireProjectAccess,
  getOrgContext,
  getProjectContext,
} from '@/middleware/requireOrg.js';
import {
  createDomainError,
  isDomainError,
  AUTH_ERRORS,
  PROJECT_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
  type DomainError,
} from '@corates/shared';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { requireOrgWriteAccess } from '@/middleware/requireOrgWriteAccess.js';
import { createInvitation } from '@/commands/invitations/index.js';
import { validationHook } from '@/lib/honoValidationHook.js';
import type { Env } from '../../types';
import { ErrorResponseSchema } from '@/schemas/common.js';

const base = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

// Response schemas
const InvitationSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    role: z.string().nullable(),
    orgRole: z.string().nullable(),
    expiresAt: z.union([z.string(), z.date(), z.number()]),
    acceptedAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    createdAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    invitedBy: z.string(),
  })
  .openapi('Invitation');

const InvitationListSchema = z.array(InvitationSchema).openapi('InvitationList');

const CreateInvitationRequestSchema = z
  .object({
    email: z.string().email('Invalid email address').openapi({ example: 'user@example.com' }),
    role: z
      .enum(['owner', 'member'], { message: 'Role must be one of: owner, member' })
      .openapi({ example: 'member' }),
    grantOrgMembership: z.boolean().optional().default(false).openapi({ example: false }),
  })
  .openapi('CreateInvitationRequest');

const InvitationCreatedSchema = z
  .object({
    success: z.boolean(),
    invitationId: z.string(),
    message: z.string(),
    email: z.string(),
  })
  .openapi('InvitationCreated');

const InvitationCancelledSchema = z
  .object({
    success: z.boolean(),
    cancelled: z.string(),
  })
  .openapi('InvitationCancelled');

// Route definitions
const listInvitationsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Project Invitations'],
  summary: 'List pending invitations',
  description: 'List all pending invitations for a project',
  responses: {
    200: {
      description: 'List of pending invitations',
      content: {
        'application/json': {
          schema: InvitationListSchema,
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

const createInvitationRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Project Invitations'],
  summary: 'Create invitation',
  description: 'Create a new project invitation (project owner only)',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: CreateInvitationRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Invitation created successfully',
      content: {
        'application/json': {
          schema: InvitationCreatedSchema,
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
    409: {
      description: 'Invitation already accepted',
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

const cancelInvitationRoute = createRoute({
  method: 'delete',
  path: '/{invitationId}',
  tags: ['Project Invitations'],
  summary: 'Cancel invitation',
  description: 'Cancel a pending invitation (project owner only)',
  request: {
    params: z.object({
      invitationId: z.string().openapi({ description: 'Invitation ID', example: 'inv-123' }),
    }),
  },
  responses: {
    200: {
      description: 'Invitation cancelled successfully',
      content: {
        'application/json': {
          schema: InvitationCancelledSchema,
        },
      },
    },
    400: {
      description: 'Invalid invitation ID',
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
    409: {
      description: 'Invitation already accepted',
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
 * GET /api/orgs/:orgId/projects/:projectId/invitations
 * List pending invitations for a project
 */
const orgInvitationRoutes = $(base.use('*', requireAuth))
  .openapi(listInvitationsRoute, async c => {
    const membershipResponse = await runMiddleware(requireOrgMembership(), c);
    if (membershipResponse) return membershipResponse as never;

    const projectAccessResponse = await runMiddleware(requireProjectAccess(), c);
    if (projectAccessResponse) return projectAccessResponse as never;

    const { projectId } = getProjectContext(c);
    if (!projectId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'project_id_required' });
      return c.json(error, 403);
    }

    const db = createDb(c.env.DB);

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
          and(eq(projectInvitations.projectId, projectId), isNull(projectInvitations.acceptedAt)),
        )
        .orderBy(desc(projectInvitations.createdAt));

      return c.json(invitations, 200);
    } catch (err) {
      const error = err as Error;
      console.error('Error listing invitations:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'list_invitations',
        originalError: error.message,
      });
      return c.json(dbError, 500);
    }
  })

  /**
   * POST /api/orgs/:orgId/projects/:projectId/invitations
   * Create a new invitation (project owner only)
   */
  .openapi(createInvitationRoute, async c => {
    const membershipResponse = await runMiddleware(requireOrgMembership(), c);
    if (membershipResponse) return membershipResponse as never;

    const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
    if (writeAccessResponse) return writeAccessResponse as never;

    const projectAccessResponse = await runMiddleware(requireProjectAccess('owner'), c);
    if (projectAccessResponse) return projectAccessResponse as never;

    const { user: authUser } = getAuth(c);
    if (!authUser) {
      const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
      return c.json(error, 401);
    }

    const { orgId } = getOrgContext(c);
    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'org_id_required' });
      return c.json(error, 403);
    }

    const { projectId } = getProjectContext(c);
    if (!projectId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'project_id_required' });
      return c.json(error, 403);
    }

    try {
      const body = c.req.valid('json');
      const { email, role } = body;

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
          invitationId: result.invitationId,
          message:
            result.emailQueued ?
              'Invitation sent successfully'
            : 'Invitation created but email delivery may be delayed',
          email,
        },
        201,
      );
    } catch (err) {
      if (isDomainError(err)) {
        return c.json(err, (err as DomainError).statusCode as ContentfulStatusCode);
      }
      const error = err as Error;
      console.error('Error creating invitation:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'create_invitation',
        originalError: error.message,
      });
      return c.json(dbError, 500);
    }
  })

  /**
   * DELETE /api/orgs/:orgId/projects/:projectId/invitations/:invitationId
   * Cancel a pending invitation (project owner only)
   */
  .openapi(cancelInvitationRoute, async c => {
    const membershipResponse = await runMiddleware(requireOrgMembership(), c);
    if (membershipResponse) return membershipResponse as never;

    const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
    if (writeAccessResponse) return writeAccessResponse as never;

    const projectAccessResponse = await runMiddleware(requireProjectAccess('owner'), c);
    if (projectAccessResponse) return projectAccessResponse as never;

    const { projectId } = getProjectContext(c);
    if (!projectId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'project_id_required' });
      return c.json(error, 403);
    }

    const { invitationId } = c.req.valid('param');
    const db = createDb(c.env.DB);

    try {
      const invitation = await db
        .select({ acceptedAt: projectInvitations.acceptedAt })
        .from(projectInvitations)
        .where(
          and(eq(projectInvitations.id, invitationId), eq(projectInvitations.projectId, projectId)),
        )
        .get();

      if (!invitation) {
        const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
          field: 'invitationId',
          value: invitationId,
        });
        return c.json(error, 400);
      }

      if (invitation.acceptedAt) {
        const error = createDomainError(PROJECT_ERRORS.INVITATION_ALREADY_ACCEPTED, {
          invitationId,
        });
        return c.json(error, PROJECT_ERRORS.INVITATION_ALREADY_ACCEPTED.statusCode);
      }

      await db.delete(projectInvitations).where(eq(projectInvitations.id, invitationId));

      return c.json({ success: true, cancelled: invitationId }, 200);
    } catch (err) {
      const error = err as Error;
      console.error('Error cancelling invitation:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'cancel_invitation',
        originalError: error.message,
      });
      return c.json(dbError, 500);
    }
  });

export { orgInvitationRoutes };
