/**
 * Invitation routes for Hono
 * Handles project invitation acceptance with combined org + project flow
 */

import { Hono } from 'hono';
import { createDb } from '../db/client.js';
import {
  projectInvitations,
  projectMembers,
  projects,
  user,
  member,
  organization,
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { invitationSchemas, validateRequest } from '../config/validation.js';
import {
  createDomainError,
  PROJECT_ERRORS,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { syncMemberToDO } from '../lib/project-sync.js';

const invitationRoutes = new Hono();

/**
 * POST /api/invitations/accept
 * Accept a project invitation by token (requires authentication)
 */
invitationRoutes.post(
  '/accept',
  requireAuth,
  validateRequest(invitationSchemas.accept),
  async c => {
    const { user: authUser } = getAuth(c);
    const db = createDb(c.env.DB);
    const { token } = c.get('validatedBody');

    try {
      // Find invitation by token (including org fields for combined flow)
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

      // Verify user email matches invitation email (security)
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

      // Normalize both emails for comparison (trim and lowercase)
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
        return c.json(error, error.statusCode);
      }

      // Check if user is already a member (edge case)
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
        // Mark invitation as accepted anyway (user was added another way)
        await db
          .update(projectInvitations)
          .set({ acceptedAt: new Date() })
          .where(eq(projectInvitations.id, invitation.id));

        // Return success - user is already a member
        const project = await db
          .select({ name: projects.name })
          .from(projects)
          .where(eq(projects.id, invitation.projectId))
          .get();

        return c.json({
          success: true,
          projectId: invitation.projectId,
          projectName: project?.name || 'Unknown Project',
          alreadyMember: true,
        });
      }

      // Combined flow: ensure org membership, then add project membership
      const nowDate = new Date();
      const batchOps = [];

      // Check if user is already an org member
      if (invitation.orgId) {
        const existingOrgMembership = await db
          .select({ id: member.id })
          .from(member)
          .where(and(eq(member.organizationId, invitation.orgId), eq(member.userId, authUser.id)))
          .get();

        if (!existingOrgMembership) {
          // Add user to org with orgRole from invitation
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

      // Add user to project
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

      await db.batch(batchOps);

      // Get project name and org slug for notification/response
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
        await syncMemberToDO(c.env, invitation.orgId, invitation.projectId, 'add', {
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
  },
);

export { invitationRoutes };
