/**
 * Org-scoped project invitation routes for Hono
 * Routes: /api/orgs/:orgId/projects/:projectId/invitations
 *
 * Combined invite flow: accepting ensures org membership then project membership
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@/db/client.js';
import {
  projectInvitations,
  projectMembers,
  projects,
  user,
  member,
  organization,
} from '@/db/schema.js';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import {
  requireOrgMembership,
  requireProjectAccess,
  getOrgContext,
  getProjectContext,
} from '@/middleware/requireOrg.js';
import { TIME_DURATIONS } from '@/config/constants.js';
import {
  createDomainError,
  PROJECT_ERRORS,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { syncMemberToDO } from '@/lib/project-sync.js';
import { requireOrgWriteAccess } from '@/middleware/requireOrgWriteAccess.js';
import { checkCollaboratorQuota } from '@/lib/quotaTransaction.js';
import { validationHook } from '@/lib/honoValidationHook.js';

const orgInvitationRoutes = new OpenAPIHono({
  defaultHook: validationHook,
});

// Apply auth middleware to all routes
orgInvitationRoutes.use('*', requireAuth);

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

const AcceptInvitationRequestSchema = z
  .object({
    token: z.string().min(1, 'Token is required').openapi({ example: 'abc123' }),
  })
  .openapi('AcceptInvitationRequest');

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

const InvitationAcceptedSchema = z
  .object({
    success: z.boolean(),
    orgId: z.string().nullable(),
    orgSlug: z.string().nullable().optional(),
    projectId: z.string(),
    projectName: z.string(),
    role: z.string().optional(),
    alreadyMember: z.boolean().optional(),
  })
  .openapi('InvitationAccepted');

const InvitationErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.unknown()).optional(),
  })
  .openapi('InvitationError');

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
          schema: InvitationErrorSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - not a project member',
      content: {
        'application/json': {
          schema: InvitationErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: InvitationErrorSchema,
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
          schema: InvitationErrorSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: InvitationErrorSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - not a project owner',
      content: {
        'application/json': {
          schema: InvitationErrorSchema,
        },
      },
    },
    409: {
      description: 'Invitation already accepted',
      content: {
        'application/json': {
          schema: InvitationErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: InvitationErrorSchema,
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
          schema: InvitationErrorSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: InvitationErrorSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - not a project owner',
      content: {
        'application/json': {
          schema: InvitationErrorSchema,
        },
      },
    },
    409: {
      description: 'Invitation already accepted',
      content: {
        'application/json': {
          schema: InvitationErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: InvitationErrorSchema,
        },
      },
    },
  },
});

const acceptInvitationRoute = createRoute({
  method: 'post',
  path: '/accept',
  tags: ['Project Invitations'],
  summary: 'Accept invitation',
  description:
    'Accept a project invitation by token. Grants org membership and project membership.',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: AcceptInvitationRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Invitation accepted successfully',
      content: {
        'application/json': {
          schema: InvitationAcceptedSchema,
        },
      },
    },
    400: {
      description: 'Invalid or expired token',
      content: {
        'application/json': {
          schema: InvitationErrorSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: InvitationErrorSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - email mismatch',
      content: {
        'application/json': {
          schema: InvitationErrorSchema,
        },
      },
    },
    409: {
      description: 'Already a project member',
      content: {
        'application/json': {
          schema: InvitationErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: InvitationErrorSchema,
        },
      },
    },
  },
});

/**
 * Helper to run middleware manually and check for early response
 */
async function runMiddleware(middleware, c) {
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
 * GET /api/orgs/:orgId/projects/:projectId/invitations
 * List pending invitations for a project
 */
orgInvitationRoutes.openapi(listInvitationsRoute, async c => {
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  const projectAccessResponse = await runMiddleware(requireProjectAccess(), c);
  if (projectAccessResponse) return projectAccessResponse;

  const { projectId } = getProjectContext(c);
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

    return c.json(invitations);
  } catch (error) {
    console.error('Error listing invitations:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'list_invitations',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST /api/orgs/:orgId/projects/:projectId/invitations
 * Create a new invitation (project owner only)
 */
orgInvitationRoutes.openapi(createInvitationRoute, async c => {
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
  if (writeAccessResponse) return writeAccessResponse;

  const projectAccessResponse = await runMiddleware(requireProjectAccess('owner'), c);
  if (projectAccessResponse) return projectAccessResponse;

  const { user: authUser } = getAuth(c);
  const { orgId } = getOrgContext(c);
  const { projectId } = getProjectContext(c);
  const db = createDb(c.env.DB);

  try {
    const body = c.req.valid('json');
    const { email, role } = body;

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

    let token;
    let invitationId;

    // Always grant org membership when accepting project invitation
    const finalGrantOrgMembership = true;

    if (existingInvitation && !existingInvitation.acceptedAt) {
      // Resend existing invitation - update role and extend expiration
      invitationId = existingInvitation.id;
      token = existingInvitation.token;
      const expiresAt = new Date(Date.now() + TIME_DURATIONS.INVITATION_EXPIRY_MS);

      await db
        .update(projectInvitations)
        .set({
          role,
          orgRole: 'member',
          grantOrgMembership: finalGrantOrgMembership,
          expiresAt,
        })
        .where(eq(projectInvitations.id, existingInvitation.id));
    } else if (existingInvitation && existingInvitation.acceptedAt) {
      const error = createDomainError(PROJECT_ERRORS.INVITATION_ALREADY_ACCEPTED, {
        invitationId: existingInvitation.id,
      });
      return c.json(error, error.statusCode);
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
        grantOrgMembership: finalGrantOrgMembership,
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
      .select({ name: user.name, displayName: user.displayName, email: user.email })
      .from(user)
      .where(eq(user.id, authUser.id))
      .get();

    // Send invitation email
    try {
      const appUrl = c.env.APP_URL || 'https://corates.org';
      const basepath = c.env.BASEPATH || '';
      const basepathNormalized = basepath ? basepath.replace(/\/$/, '') : '';
      const callbackPath = `${basepathNormalized}/complete-profile?invitation=${token}`;
      const callbackURL = `${appUrl}${callbackPath}`;

      const authBaseUrl = c.env.AUTH_BASE_URL || c.env.APP_URL || 'https://corates.org';
      let capturedMagicLinkUrl = null;

      const { betterAuth } = await import('better-auth');
      const { magicLink } = await import('better-auth/plugins');
      const { drizzleAdapter } = await import('better-auth/adapters/drizzle');
      const { drizzle } = await import('drizzle-orm/d1');
      const schema = await import('@/db/schema.js');
      const { MAGIC_LINK_EXPIRY_MINUTES } = await import('@/auth/emailTemplates.js');

      const authSecret = c.env.AUTH_SECRET || c.env.SECRET;
      if (!authSecret) {
        throw createDomainError(
          SYSTEM_ERRORS.INTERNAL_ERROR,
          { key: 'AUTH_SECRET' },
          'AUTH_SECRET must be configured',
        );
      }

      const tempDb = drizzle(c.env.DB, { schema });
      const tempAuth = betterAuth({
        database: drizzleAdapter(tempDb, {
          provider: 'sqlite',
          schema: {
            user: schema.user,
            session: schema.session,
            account: schema.account,
            verification: schema.verification,
            twoFactor: schema.twoFactor,
          },
        }),
        baseURL: authBaseUrl,
        secret: authSecret,
        plugins: [
          magicLink({
            sendMagicLink: async ({ url }) => {
              capturedMagicLinkUrl = url;
            },
            expiresIn: 60 * MAGIC_LINK_EXPIRY_MINUTES,
          }),
        ],
      });

      await tempAuth.api.signInMagicLink({
        body: {
          email: email.toLowerCase(),
          callbackURL: callbackURL,
          newUserCallbackURL: callbackURL,
        },
        headers: new Headers(),
      });

      if (!capturedMagicLinkUrl) {
        throw createDomainError(
          SYSTEM_ERRORS.INTERNAL_ERROR,
          { service: 'magic-link' },
          'Failed to generate magic link URL',
        );
      }

      if (c.env.ENVIRONMENT !== 'production') {
        console.log('[Email] Project invitation magic link URL:', capturedMagicLinkUrl);
      }

      const { getProjectInvitationEmailHtml, getProjectInvitationEmailText } =
        await import('@/auth/emailTemplates.js');
      const { escapeHtml } = await import('@/lib/escapeHtml.js');

      const projectName = project?.name || 'Unknown Project';
      const inviterName = inviter?.displayName || inviter?.name || inviter?.email || 'Someone';

      const emailHtml = getProjectInvitationEmailHtml({
        projectName,
        inviterName,
        invitationUrl: capturedMagicLinkUrl,
        role,
      });
      const emailText = getProjectInvitationEmailText({
        projectName,
        inviterName,
        invitationUrl: capturedMagicLinkUrl,
        role,
      });

      const safeProjectName = escapeHtml(projectName);

      const queueId = c.env.EMAIL_QUEUE.idFromName('default');
      const queue = c.env.EMAIL_QUEUE.get(queueId);
      await queue.fetch(
        new Request('https://internal/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            subject: `You're Invited to "${safeProjectName}" - CoRATES`,
            html: emailHtml,
            text: emailText,
          }),
        }),
      );
    } catch (err) {
      console.error('Failed to queue invitation email:', err);
    }

    return c.json(
      {
        success: true,
        invitationId,
        message: 'Invitation sent successfully',
        email,
      },
      201,
    );
  } catch (error) {
    console.error('Error creating invitation:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'create_invitation',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * DELETE /api/orgs/:orgId/projects/:projectId/invitations/:invitationId
 * Cancel a pending invitation (project owner only)
 */
orgInvitationRoutes.openapi(cancelInvitationRoute, async c => {
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
  if (writeAccessResponse) return writeAccessResponse;

  const projectAccessResponse = await runMiddleware(requireProjectAccess('owner'), c);
  if (projectAccessResponse) return projectAccessResponse;

  const { projectId } = getProjectContext(c);
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
      return c.json(error, error.statusCode);
    }

    if (invitation.acceptedAt) {
      const error = createDomainError(PROJECT_ERRORS.INVITATION_ALREADY_ACCEPTED, {
        invitationId,
      });
      return c.json(error, error.statusCode);
    }

    await db.delete(projectInvitations).where(eq(projectInvitations.id, invitationId));

    return c.json({ success: true, cancelled: invitationId });
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'cancel_invitation',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST /api/orgs/:orgId/projects/:projectId/invitations/accept
 * Accept a project invitation by token
 */
orgInvitationRoutes.openapi(acceptInvitationRoute, async c => {
  const { user: authUser } = getAuth(c);
  const db = createDb(c.env.DB);
  const { token } = c.req.valid('json');

  try {
    // Find invitation by token (includes org fields)
    const invitation = await db
      .select({
        id: projectInvitations.id,
        orgId: projectInvitations.orgId,
        projectId: projectInvitations.projectId,
        email: projectInvitations.email,
        role: projectInvitations.role,
        orgRole: projectInvitations.orgRole,
        grantOrgMembership: projectInvitations.grantOrgMembership,
        expiresAt: projectInvitations.expiresAt,
        acceptedAt: projectInvitations.acceptedAt,
      })
      .from(projectInvitations)
      .where(eq(projectInvitations.token, token))
      .get();

    if (!invitation) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'token',
        value: token,
      });
      return c.json(error, error.statusCode);
    }

    // Check if invitation has expired
    const now = Date.now();
    const expiresAt = invitation.expiresAt.getTime();
    if (now > expiresAt) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'token',
        value: 'expired',
      });
      return c.json(error, error.statusCode);
    }

    // Check if invitation already accepted
    if (invitation.acceptedAt) {
      const error = createDomainError(PROJECT_ERRORS.MEMBER_ALREADY_EXISTS, {
        projectId: invitation.projectId,
      });
      return c.json(error, error.statusCode);
    }

    // Verify user email matches invitation email
    const currentUser = await db
      .select({
        email: user.email,
        name: user.name,
        displayName: user.displayName,
        image: user.image,
      })
      .from(user)
      .where(eq(user.id, authUser.id))
      .get();

    if (!currentUser) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'user_not_found',
      });
      return c.json(error, error.statusCode);
    }

    // Normalize both emails for comparison
    const normalizedUserEmail = (currentUser.email || '').trim().toLowerCase();
    const normalizedInvitationEmail = (invitation.email || '').trim().toLowerCase();

    if (normalizedUserEmail !== normalizedInvitationEmail) {
      console.error(
        `[Invitation] Email mismatch: user email="${currentUser.email}", invitation email="${invitation.email}"`,
      );
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'email_mismatch',
        userEmail: currentUser.email,
        invitationEmail: invitation.email,
      });
      return c.json(error, error.statusCode);
    }

    // Check if user is already a project member
    const existingMember = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, invitation.projectId),
          eq(projectMembers.userId, authUser.id),
        ),
      )
      .get();

    if (existingMember) {
      // Mark invitation as accepted anyway
      await db
        .update(projectInvitations)
        .set({ acceptedAt: new Date() })
        .where(eq(projectInvitations.id, invitation.id));

      const project = await db
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, invitation.projectId))
        .get();

      return c.json({
        success: true,
        orgId: invitation.orgId,
        projectId: invitation.projectId,
        projectName: project?.name || 'Unknown Project',
        alreadyMember: true,
      });
    }

    // Enforce collaborator quota before acceptance
    if (invitation.orgId) {
      // Check if user is already an org member
      const existingOrgMembership = await db
        .select({ id: member.id, role: member.role })
        .from(member)
        .where(and(eq(member.organizationId, invitation.orgId), eq(member.userId, authUser.id)))
        .get();

      // Only enforce quota if user is not already an org member
      if (!existingOrgMembership) {
        const quotaResult = await checkCollaboratorQuota(db, invitation.orgId);
        if (!quotaResult.allowed) {
          return c.json(quotaResult.error, quotaResult.error.statusCode);
        }
      }
    }

    // Always grant org membership and add project membership
    const nowDate = new Date();
    const batchOps = [];

    // Always add user to org with role 'member' (if not already a member)
    if (invitation.orgId) {
      const existingOrgMembership = await db
        .select({ id: member.id })
        .from(member)
        .where(and(eq(member.organizationId, invitation.orgId), eq(member.userId, authUser.id)))
        .get();

      if (!existingOrgMembership) {
        batchOps.push(
          db.insert(member).values({
            id: crypto.randomUUID(),
            userId: authUser.id,
            organizationId: invitation.orgId,
            role: 'member',
            createdAt: nowDate,
          }),
        );
      }
    }

    // Always add user to project (projects are invite-only)
    batchOps.push(
      db.insert(projectMembers).values({
        id: crypto.randomUUID(),
        projectId: invitation.projectId,
        userId: authUser.id,
        role: invitation.role,
        joinedAt: nowDate,
      }),
    );

    // Mark invitation as accepted
    batchOps.push(
      db
        .update(projectInvitations)
        .set({ acceptedAt: nowDate })
        .where(eq(projectInvitations.id, invitation.id)),
    );

    // Execute atomically
    await db.batch(batchOps);

    // Post-insert verification for collaborator quota race conditions
    if (invitation.orgId) {
      const postInsertQuotaResult = await checkCollaboratorQuota(db, invitation.orgId);
      if (
        !postInsertQuotaResult.allowed &&
        postInsertQuotaResult.used > postInsertQuotaResult.limit
      ) {
        // Race condition detected - log for admin review
        console.warn(
          `[Invitation] Race condition detected: collaborator quota exceeded for org ${invitation.orgId}. ` +
            `Count: ${postInsertQuotaResult.used}, Limit: ${postInsertQuotaResult.limit}. ` +
            `User ${authUser.id} was still added. Consider manual intervention.`,
        );
      }
    }

    // Get project name and org slug for response
    const project = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, invitation.projectId))
      .get();

    // Get org slug for navigation
    let orgSlug = null;
    if (invitation.orgId) {
      const org = await db
        .select({ slug: organization.slug })
        .from(organization)
        .where(eq(organization.id, invitation.orgId))
        .get();
      orgSlug = org?.slug;
    }

    // Send notification to the added user via their UserSession DO
    try {
      const userSessionId = c.env.USER_SESSION.idFromName(authUser.id);
      const userSession = c.env.USER_SESSION.get(userSessionId);
      await userSession.fetch(
        new Request('https://internal/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'project-invite',
            projectId: invitation.projectId,
            projectName: project?.name || 'Unknown Project',
            role: invitation.role,
            timestamp: Date.now(),
          }),
        }),
      );
    } catch (err) {
      console.error('Failed to send project invite notification:', err);
    }

    // Sync member to DO
    try {
      await syncMemberToDO(c.env, invitation.projectId, 'add', {
        userId: authUser.id,
        role: invitation.role,
        joinedAt: nowDate.getTime(),
        name: currentUser.name,
        email: currentUser.email,
        displayName: currentUser.displayName,
        image: currentUser.image,
      });
    } catch (err) {
      console.error('Failed to sync member to DO:', err);
    }

    return c.json({
      success: true,
      orgId: invitation.orgId,
      orgSlug,
      projectId: invitation.projectId,
      projectName: project?.name || 'Unknown Project',
      role: invitation.role,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'accept_invitation',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { orgInvitationRoutes };
