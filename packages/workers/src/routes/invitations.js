/**
 * Invitation routes for Hono
 * Handles project invitation acceptance
 */

import { Hono } from 'hono';
import { createDb } from '../db/client.js';
import { projectInvitations, projectMembers, projects, user } from '../db/schema.js';
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

const invitationRoutes = new Hono();

/**
 * Sync a member change to the Durable Object
 */
async function syncMemberToDO(env, projectId, action, memberData) {
  try {
    const doId = env.PROJECT_DOC.idFromName(projectId);
    const projectDoc = env.PROJECT_DOC.get(doId);

    await projectDoc.fetch(
      new Request('https://internal/sync-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true',
        },
        body: JSON.stringify({ action, member: memberData }),
      }),
    );
  } catch (err) {
    console.error('Failed to sync member to DO:', err);
  }
}

/**
 * POST /api/invitations/accept
 * Accept a project invitation by token (requires authentication)
 */
invitationRoutes.post('/accept', requireAuth, validateRequest(invitationSchemas.accept), async c => {
  const { user: authUser } = getAuth(c);
  const db = createDb(c.env.DB);
  const { token } = c.get('validatedBody');

  try {
    // Find invitation by token
    const invitation = await db
      .select({
        id: projectInvitations.id,
        projectId: projectInvitations.projectId,
        email: projectInvitations.email,
        role: projectInvitations.role,
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

    if (!currentUser || currentUser.email.toLowerCase() !== invitation.email.toLowerCase()) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'email_mismatch',
      });
      return c.json(error, error.statusCode);
    }

    // Check if user is already a member (edge case)
    const existingMember = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, invitation.projectId), eq(projectMembers.userId, authUser.id)))
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

    // Add user to project
    const nowDate = new Date();
    await db.insert(projectMembers).values({
      id: crypto.randomUUID(),
      projectId: invitation.projectId,
      userId: authUser.id,
      role: invitation.role,
      joinedAt: nowDate,
    });

    // Mark invitation as accepted
    await db
      .update(projectInvitations)
      .set({ acceptedAt: nowDate })
      .where(eq(projectInvitations.id, invitation.id));

    // Get project name for notification
    const project = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, invitation.projectId))
      .get();

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
    await syncMemberToDO(c.env, invitation.projectId, 'add', {
      userId: authUser.id,
      role: invitation.role,
      joinedAt: nowDate.getTime(),
      name: currentUser.name,
      email: currentUser.email,
      displayName: currentUser.displayName,
      image: currentUser.image,
    });

    return c.json({
      success: true,
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

export { invitationRoutes };
