/**
 * Project member routes for Hono
 * Handles project membership management
 */

import { Hono } from 'hono';
import { createDb } from '../db/client.js';
import { projectMembers, user, projects, projectInvitations } from '../db/schema.js';
import { eq, and, count } from 'drizzle-orm';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { memberSchemas, validateRequest } from '../config/validation.js';
import {
  createDomainError,
  PROJECT_ERRORS,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  USER_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';

const memberRoutes = new Hono();

// Apply auth middleware to all routes
memberRoutes.use('*', requireAuth);

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
 * Middleware to verify project membership and set context
 */
async function projectMembershipMiddleware(c, next) {
  const { user: authUser } = getAuth(c);
  const projectId = c.req.param('projectId');

  if (!projectId) {
    const error = createDomainError(
      VALIDATION_ERRORS.FIELD_REQUIRED,
      { field: 'projectId' },
      'Project ID required',
    );
    return c.json(error, error.statusCode);
  }

  const db = createDb(c.env.DB);

  // Check if user has access to this project
  const membership = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, authUser.id)))
    .get();

  if (!membership) {
    const error = createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
    return c.json(error, error.statusCode);
  }

  c.set('projectId', projectId);
  c.set('membership', membership);
  c.set('isOwner', membership.role === 'owner');

  await next();
}

// Apply project membership middleware to all routes
memberRoutes.use('*', projectMembershipMiddleware);

/**
 * GET /api/projects/:projectId/members
 * List all members of a project
 */
memberRoutes.get('/', async c => {
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
        displayName: user.displayName,
        image: user.image,
      })
      .from(projectMembers)
      .innerJoin(user, eq(projectMembers.userId, user.id))
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(projectMembers.joinedAt);

    return c.json(results);
  } catch (error) {
    console.error('Error listing members:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'list_members',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST /api/projects/:projectId/members
 * Add a member to the project (owner only)
 */
memberRoutes.post('/', validateRequest(memberSchemas.add), async c => {
  const isOwner = c.get('isOwner');
  const projectId = c.get('projectId');

  if (!isOwner) {
    const error = createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'add_member' },
      'Only project owners can add members',
    );
    return c.json(error, error.statusCode);
  }

  const db = createDb(c.env.DB);
  const { userId, email, role } = c.get('validatedBody');
  const { user: authUser } = getAuth(c);

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
          displayName: user.displayName,
          image: user.image,
        })
        .from(user)
        .where(eq(user.id, userId))
        .get();
    } else {
      userToAdd = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          image: user.image,
        })
        .from(user)
        .where(eq(user.email, email.toLowerCase()))
        .get();
    }

    // If user doesn't exist and email was provided, create or resend an invitation
    if (!userToAdd && email) {
      // Check for existing pending invitation for this email/project
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

      if (existingInvitation && !existingInvitation.acceptedAt) {
        // Resend existing invitation - update role and extend expiration
        invitationId = existingInvitation.id;
        token = existingInvitation.token;
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await db
          .update(projectInvitations)
          .set({
            role,
            expiresAt,
          })
          .where(eq(projectInvitations.id, existingInvitation.id));
      } else if (existingInvitation && existingInvitation.acceptedAt) {
        // Invitation was already accepted, can't resend
        const error = createDomainError(PROJECT_ERRORS.INVITATION_ALREADY_ACCEPTED, {
          invitationId: existingInvitation.id,
        });
        return c.json(error, error.statusCode);
      } else {
        // Create new invitation
        invitationId = crypto.randomUUID();
        token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await db.insert(projectInvitations).values({
          id: invitationId,
          projectId,
          email: email.toLowerCase(),
          role,
          token,
          invitedBy: authUser.id,
          expiresAt,
          createdAt: new Date(),
        });
      }

      // Get project name and inviter name
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

      // Generate magic link URL for invitation
      try {
        const appUrl = c.env.APP_URL || 'https://corates.org';
        const basepath = c.env.BASEPATH || '';
        const basepathNormalized = basepath ? basepath.replace(/\/$/, '') : '';

        // Create callback URL with invitation token
        const callbackPath = `${basepathNormalized}/complete-profile?invitation=${token}`;
        const callbackURL = `${appUrl}${callbackPath}`;

      // Generate magic link using Better Auth's API
      // We'll use Better Auth's signInMagicLink but intercept sendMagicLink to capture the URL
      const authBaseUrl = c.env.AUTH_BASE_URL || c.env.APP_URL || 'https://api.corates.org';
      let capturedMagicLinkUrl = null;

      // Import required modules
      const { betterAuth } = await import('better-auth');
      const { magicLink } = await import('better-auth/plugins');
      const { drizzleAdapter } = await import('better-auth/adapters/drizzle');
      const { drizzle } = await import('drizzle-orm/d1');
      const schema = await import('../db/schema.js');
      const { MAGIC_LINK_EXPIRY_MINUTES } = await import('../auth/emailTemplates.js');

      // Get auth secret from environment (same logic as getAuthSecret)
      const authSecret = c.env.AUTH_SECRET || c.env.SECRET;
      if (!authSecret) {
        throw new Error('AUTH_SECRET must be configured');
      }

      // Create a temporary auth instance with a custom sendMagicLink that captures the URL
      // Dynamic import returns module namespace, exports are directly on the object
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
              // Capture the URL instead of sending email
              capturedMagicLinkUrl = url;
            },
            expiresIn: 60 * MAGIC_LINK_EXPIRY_MINUTES,
          }),
        ],
      });

      // Call Better Auth's signInMagicLink API
      await tempAuth.api.signInMagicLink({
        body: {
          email: email.toLowerCase(),
          callbackURL: callbackURL,
          newUserCallbackURL: callbackURL,
        },
        headers: new Headers(),
      });

      if (!capturedMagicLinkUrl) {
        throw new Error('Failed to generate magic link URL');
      }

      const magicLinkUrl = capturedMagicLinkUrl;

        // Log magic link URL in development
        if (c.env.ENVIRONMENT !== 'production') {
          console.log('[Email] Project invitation magic link URL:', magicLinkUrl);
        }

        const { getProjectInvitationEmailHtml, getProjectInvitationEmailText } =
          await import('../auth/emailTemplates.js');
        const { escapeHtml } = await import('../lib/escapeHtml.js');

        const projectName = project?.name || 'Unknown Project';
        const inviterName = inviter?.displayName || inviter?.name || inviter?.email || 'Someone';

        const emailHtml = getProjectInvitationEmailHtml({
          projectName,
          inviterName,
          invitationUrl: magicLinkUrl, // Use magic link URL instead of signup link
          role,
        });
        const emailText = getProjectInvitationEmailText({
          projectName,
          inviterName,
          invitationUrl: magicLinkUrl,
          role,
        });

        // Escape projectName for email subject (plain text, but sanitize for safety)
        const safeProjectName = escapeHtml(projectName);

        // Queue email via EMAIL_QUEUE DO
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
        // Continue anyway - invitation is created
      }

      return c.json(
        {
          success: true,
          invitation: true,
          message: 'Invitation sent successfully',
          email,
        },
        201,
      );
    }

    if (!userToAdd) {
      const error = createDomainError(USER_ERRORS.NOT_FOUND, { userId, email });
      return c.json(error, error.statusCode);
    }

    // Check if already a member
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
      return c.json(error, error.statusCode);
    }

    const now = new Date();
    await db.insert(projectMembers).values({
      id: crypto.randomUUID(),
      projectId,
      userId: userToAdd.id,
      role,
      joinedAt: now,
    });

    // Get project name for notification
    const project = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    // Send notification to the added user via their UserSession DO
    try {
      const userSessionId = c.env.USER_SESSION.idFromName(userToAdd.id);
      const userSession = c.env.USER_SESSION.get(userSessionId);
      await userSession.fetch(
        new Request('https://internal/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'project-invite',
            projectId,
            projectName: project?.name || 'Unknown Project',
            role,
            timestamp: Date.now(),
          }),
        }),
      );
    } catch (err) {
      console.error('Failed to send project invite notification:', err);
    }

    // Sync member to DO
    await syncMemberToDO(c.env, projectId, 'add', {
      userId: userToAdd.id,
      role,
      joinedAt: now.getTime(),
      name: userToAdd.name,
      email: userToAdd.email,
      displayName: userToAdd.displayName,
      image: userToAdd.image,
    });

    return c.json(
      {
        userId: userToAdd.id,
        name: userToAdd.name,
        email: userToAdd.email,
        username: userToAdd.username,
        displayName: userToAdd.displayName,
        image: userToAdd.image,
        role,
        joinedAt: now,
      },
      201,
    );
  } catch (error) {
    console.error('Error adding member:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'add_member',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * PUT /api/projects/:projectId/members/:userId
 * Update a member's role (owner only)
 */
memberRoutes.put('/:userId', validateRequest(memberSchemas.updateRole), async c => {
  const isOwner = c.get('isOwner');
  const projectId = c.get('projectId');
  const memberId = c.req.param('userId');

  if (!isOwner) {
    const error = createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'update_member_role' },
      'Only project owners can update member roles',
    );
    return c.json(error, error.statusCode);
  }

  const db = createDb(c.env.DB);
  const { role } = c.get('validatedBody');

  try {
    // Prevent removing the last owner
    if (role !== 'owner') {
      const ownerCountResult = await db
        .select({ count: count() })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'owner')))
        .get();

      const targetMember = await db
        .select({ role: projectMembers.role })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberId)))
        .get();

      if (targetMember?.role === 'owner' && ownerCountResult?.count <= 1) {
        const error = createDomainError(
          PROJECT_ERRORS.LAST_OWNER,
          { projectId },
          'Assign another owner first',
        );
        return c.json(error, error.statusCode);
      }
    }

    await db
      .update(projectMembers)
      .set({ role })
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberId)));

    // Sync role update to DO
    await syncMemberToDO(c.env, projectId, 'update', {
      userId: memberId,
      role,
    });

    return c.json({ success: true, userId: memberId, role });
  } catch (error) {
    console.error('Error updating member role:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_member_role',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * DELETE /api/projects/:projectId/members/:userId
 * Remove a member from the project (owner only, or self-removal)
 */
memberRoutes.delete('/:userId', async c => {
  const { user: authUser } = getAuth(c);
  const isOwner = c.get('isOwner');
  const projectId = c.get('projectId');
  const memberId = c.req.param('userId');

  const isSelfRemoval = memberId === authUser.id;

  if (!isOwner && !isSelfRemoval) {
    const error = createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'remove_member' },
      'Only project owners can remove members',
    );
    return c.json(error, error.statusCode);
  }

  const db = createDb(c.env.DB);

  try {
    // Check target member exists
    const targetMember = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberId)))
      .get();

    if (!targetMember) {
      const error = createDomainError(
        PROJECT_ERRORS.NOT_FOUND,
        { projectId, userId: memberId },
        'Member not found',
      );
      return c.json(error, error.statusCode);
    }

    // Prevent removing the last owner
    if (targetMember.role === 'owner') {
      const ownerCountResult = await db
        .select({ count: count() })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'owner')))
        .get();

      if (ownerCountResult?.count <= 1) {
        const error = createDomainError(
          PROJECT_ERRORS.LAST_OWNER,
          { projectId },
          'Assign another owner first or delete the project',
        );
        return c.json(error, error.statusCode);
      }
    }

    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberId)));

    // Sync member removal to DO (this also forces disconnect)
    await syncMemberToDO(c.env, projectId, 'remove', {
      userId: memberId,
    });

    // Send notification to removed user (if not self-removal)
    if (!isSelfRemoval) {
      try {
        // Get project name for notification
        const project = await db
          .select({ name: projects.name })
          .from(projects)
          .where(eq(projects.id, projectId))
          .get();

        const userSessionId = c.env.USER_SESSION.idFromName(memberId);
        const userSession = c.env.USER_SESSION.get(userSessionId);
        await userSession.fetch(
          new Request('https://internal/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'removed-from-project',
              projectId,
              projectName: project?.name || 'Unknown Project',
              removedBy: authUser.name || authUser.email,
              timestamp: Date.now(),
            }),
          }),
        );
      } catch (err) {
        console.error('Failed to send removal notification:', err);
      }
    }

    return c.json({ success: true, removed: memberId });
  } catch (error) {
    console.error('Error removing member:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'remove_member',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { memberRoutes };
