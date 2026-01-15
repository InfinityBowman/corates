/**
 * Invitation routes for Hono
 * Handles project invitation acceptance with combined org + project flow
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { createDb } from '@/db/client.js';
import {
  projectInvitations,
  projectMembers,
  projects,
  user,
  member,
  organization,
} from '@/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import {
  createDomainError,
  PROJECT_ERRORS,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { syncMemberToDO } from '@/lib/project-sync.js';
import { validationHook } from '@/lib/honoValidationHook.js';
import type { Env } from '../types';

const invitationRoutes = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

// Apply auth middleware
invitationRoutes.use('*', requireAuth);

// Request schema
const AcceptInvitationRequestSchema = z
  .object({
    token: z.string().min(1).openapi({ example: 'abc123token' }),
  })
  .openapi('AcceptInvitationRequest');

// Response schemas
const AcceptInvitationSuccessSchema = z
  .object({
    success: z.literal(true),
    orgId: z.string().nullable().optional(),
    orgSlug: z.string().nullable().optional(),
    projectId: z.string(),
    projectName: z.string(),
    role: z.string().optional(),
    alreadyMember: z.boolean().optional(),
  })
  .openapi('AcceptInvitationSuccess');

const InvitationErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('InvitationError');

// Accept invitation route
const acceptInvitationRoute = createRoute({
  method: 'post',
  path: '/accept',
  tags: ['Invitations'],
  summary: 'Accept project invitation',
  description: 'Accept a project invitation by token. Also adds user to organization if needed.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: AcceptInvitationRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AcceptInvitationSuccessSchema,
        },
      },
      description: 'Invitation accepted successfully',
    },
    400: {
      content: { 'application/json': { schema: InvitationErrorSchema } },
      description: 'Invalid or expired token',
    },
    403: {
      content: { 'application/json': { schema: InvitationErrorSchema } },
      description: 'Email mismatch or already a member',
    },
  },
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
invitationRoutes.openapi(acceptInvitationRoute, async (c) => {
  const { user: authUser } = getAuth(c);
  if (!authUser) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }
  const db = createDb(c.env.DB);
  const { token } = c.req.valid('json');

  try {
    // Find invitation by token
    const invitation = await db
      .select({
        id: projectInvitations.id,
        orgId: projectInvitations.orgId,
        projectId: projectInvitations.projectId,
        email: projectInvitations.email,
        role: projectInvitations.role,
        orgRole: projectInvitations.orgRole,
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
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Check if invitation has expired
    const now = Date.now();
    const expiresAt = invitation.expiresAt.getTime();
    if (now > expiresAt) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'token',
        value: 'expired',
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Check if invitation already accepted
    if (invitation.acceptedAt) {
      const error = createDomainError(PROJECT_ERRORS.MEMBER_ALREADY_EXISTS, {
        projectId: invitation.projectId,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
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
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    const normalizedUserEmail = (currentUser.email || '').trim().toLowerCase();
    const normalizedInvitationEmail = (invitation.email || '').trim().toLowerCase();

    if (normalizedUserEmail !== normalizedInvitationEmail) {
      console.error(
        `[Invitation] Email mismatch: user email="${currentUser.email}" (normalized="${normalizedUserEmail}"), invitation email="${invitation.email}" (normalized="${normalizedInvitationEmail}")`,
      );
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'email_mismatch',
        userEmail: currentUser.email,
        invitationEmail: invitation.email,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Check if user is already a member
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
        success: true as const,
        projectId: invitation.projectId,
        projectName: project?.name || 'Unknown Project',
        alreadyMember: true,
      });
    }

    // Combined flow: ensure org membership, then add project membership
    const nowDate = new Date();
    const batchOps = [];

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
            role: invitation.orgRole || 'member',
            createdAt: nowDate,
          }),
        );
      }
    }

    batchOps.push(
      db.insert(projectMembers).values({
        id: crypto.randomUUID(),
        projectId: invitation.projectId,
        userId: authUser.id,
        role: invitation.role,
        joinedAt: nowDate,
      }),
    );

    batchOps.push(
      db
        .update(projectInvitations)
        .set({ acceptedAt: nowDate })
        .where(eq(projectInvitations.id, invitation.id)),
    );

    // Type assertion needed because TypeScript can't infer the array always has elements
    await db.batch(batchOps as [typeof batchOps[0], ...typeof batchOps]);

    const project = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, invitation.projectId))
      .get();

    let orgSlug: string | null = null;
    if (invitation.orgId) {
      const org = await db
        .select({ slug: organization.slug })
        .from(organization)
        .where(eq(organization.id, invitation.orgId))
        .get();
      orgSlug = org?.slug || null;
    }

    // Send notification
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
        role: invitation.role ?? undefined,
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
      success: true as const,
      orgId: invitation.orgId,
      orgSlug: orgSlug ?? undefined,
      projectId: invitation.projectId,
      projectName: project?.name || 'Unknown Project',
      role: invitation.role,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    const err = error as Error;
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'accept_invitation',
      originalError: err.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

export { invitationRoutes };
