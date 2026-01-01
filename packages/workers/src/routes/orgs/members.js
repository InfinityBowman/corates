/**
 * Org-scoped project member routes for Hono
 * Routes: /api/orgs/:orgId/projects/:projectId/members
 */

import { Hono } from 'hono';
import { createDb } from '../../db/client.js';
import { projectMembers, user, projects, projectInvitations, member } from '../../db/schema.js';
import { eq, and, count } from 'drizzle-orm';
import { requireAuth, getAuth } from '../../middleware/auth.js';
import {
  requireOrgMembership,
  requireProjectAccess,
  getOrgContext,
  getProjectContext,
} from '../../middleware/requireOrg.js';
import { memberSchemas, validateRequest } from '../../config/validation.js';
import {
  createDomainError,
  PROJECT_ERRORS,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  USER_ERRORS,
} from '@corates/shared';
import { syncMemberToDO } from '../../lib/project-sync.js';

const orgProjectMemberRoutes = new Hono();

// Apply auth and org/project membership middleware to all routes
orgProjectMemberRoutes.use('*', requireAuth);

/**
 * GET /api/orgs/:orgId/projects/:projectId/members
 * List all members of a project
 */
orgProjectMemberRoutes.get('/', requireOrgMembership(), requireProjectAccess(), async c => {
  const { projectId } = getProjectContext(c);
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
    console.error('Error listing project members:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'list_project_members',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST /api/orgs/:orgId/projects/:projectId/members
 * Add a member to the project (project owner only)
 * Combined invite flow: ensures org membership first, then adds project membership
 */
orgProjectMemberRoutes.post(
  '/',
  requireOrgMembership(),
  requireProjectAccess('owner'),
  validateRequest(memberSchemas.add),
  async c => {
    const { orgId } = getOrgContext(c);
    const { projectId } = getProjectContext(c);
    const db = createDb(c.env.DB);
    const { userId, email, role } = c.get('validatedBody');

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

      // If user doesn't exist and email was provided, create an invitation
      if (!userToAdd && email) {
        return await handleInvitation(c, { orgId, projectId, email, role });
      }

      if (!userToAdd) {
        const error = createDomainError(USER_ERRORS.NOT_FOUND, { userId, email });
        return c.json(error, error.statusCode);
      }

      // Check if already a project member
      const existingMember = await db
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(
          and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userToAdd.id)),
        )
        .get();

      if (existingMember) {
        const error = createDomainError(PROJECT_ERRORS.MEMBER_ALREADY_EXISTS, {
          projectId,
          userId: userToAdd.id,
        });
        return c.json(error, error.statusCode);
      }

      // Ensure org membership first (combined flow)
      await ensureOrgMembership(db, orgId, userToAdd.id);

      // Add project membership
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

      // Send notification to the added user
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
      try {
        await syncMemberToDO(c.env, projectId, 'add', {
          userId: userToAdd.id,
          role,
          joinedAt: now.getTime(),
          name: userToAdd.name,
          email: userToAdd.email,
          displayName: userToAdd.displayName,
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
          displayName: userToAdd.displayName,
          image: userToAdd.image,
          role,
          joinedAt: now,
        },
        201,
      );
    } catch (error) {
      console.error('Error adding project member:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'add_project_member',
        originalError: error.message,
      });
      return c.json(dbError, dbError.statusCode);
    }
  },
);

/**
 * PUT /api/orgs/:orgId/projects/:projectId/members/:userId
 * Update a member's role (project owner only)
 */
orgProjectMemberRoutes.put(
  '/:userId',
  requireOrgMembership(),
  requireProjectAccess('owner'),
  validateRequest(memberSchemas.updateRole),
  async c => {
    const { orgId } = getOrgContext(c);
    const { projectId } = getProjectContext(c);
    const memberId = c.req.param('userId');
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
      try {
        await syncMemberToDO(c.env, projectId, 'update', {
          userId: memberId,
          role,
        });
      } catch (err) {
        console.error('Failed to sync member update to DO:', err);
      }

      return c.json({ success: true, userId: memberId, role });
    } catch (error) {
      console.error('Error updating project member role:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'update_project_member_role',
        originalError: error.message,
      });
      return c.json(dbError, dbError.statusCode);
    }
  },
);

/**
 * DELETE /api/orgs/:orgId/projects/:projectId/members/:userId
 * Remove a member from the project (project owner only, or self-removal)
 */
orgProjectMemberRoutes.delete(
  '/:userId',
  requireOrgMembership(),
  requireProjectAccess(),
  async c => {
    const { user: authUser } = getAuth(c);
    const { orgId } = getOrgContext(c);
    const { projectId, projectRole } = getProjectContext(c);
    const memberId = c.req.param('userId');
    const db = createDb(c.env.DB);

    const isSelf = memberId === authUser.id;
    const isOwner = projectRole === 'owner';

    if (!isOwner && !isSelf) {
      const error = createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'remove_member' },
        'Only project owners can remove members',
      );
      return c.json(error, error.statusCode);
    }

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

      // Sync member removal to DO
      try {
        await syncMemberToDO(c.env, projectId, 'remove', {
          userId: memberId,
        });
      } catch (err) {
        console.error('Failed to sync member removal to DO:', err);
      }

      // Send notification to removed user (if not self-removal)
      if (!isSelf) {
        try {
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
      console.error('Error removing project member:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'remove_project_member',
        originalError: error.message,
      });
      return c.json(dbError, dbError.statusCode);
    }
  },
);

/**
 * Ensure user is a member of the organization, adding them if not
 */
async function ensureOrgMembership(db, orgId, userId, role = 'member') {
  const existingMembership = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
    .get();

  if (existingMembership) {
    return existingMembership;
  }

  // Add user to org with specified role
  const memberId = crypto.randomUUID();
  const now = new Date();

  await db.insert(member).values({
    id: memberId,
    userId,
    organizationId: orgId,
    role,
    createdAt: now,
  });

  return { id: memberId, role };
}

/**
 * Handle invitation for users who don't have accounts yet
 */
async function handleInvitation(c, { orgId, projectId, email, role }) {
  const { user: authUser } = getAuth(c);
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

  let token;
  let invitationId;

  if (existingInvitation && !existingInvitation.acceptedAt) {
    // Resend existing invitation
    invitationId = existingInvitation.id;
    token = existingInvitation.token;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db
      .update(projectInvitations)
      .set({ role, expiresAt })
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
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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

    const authBaseUrl = c.env.AUTH_BASE_URL || c.env.APP_URL || 'https://api.corates.org';
    let capturedMagicLinkUrl = null;

    const { betterAuth } = await import('better-auth');
    const { magicLink } = await import('better-auth/plugins');
    const { drizzleAdapter } = await import('better-auth/adapters/drizzle');
    const { drizzle } = await import('drizzle-orm/d1');
    const schema = await import('../../db/schema.js');
    const { MAGIC_LINK_EXPIRY_MINUTES } = await import('../../auth/emailTemplates.js');

    const authSecret = c.env.AUTH_SECRET || c.env.SECRET;
    if (!authSecret) {
      throw new Error('AUTH_SECRET must be configured');
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
      throw new Error('Failed to generate magic link URL');
    }

    if (c.env.ENVIRONMENT !== 'production') {
      console.log('[Email] Project invitation magic link URL:', capturedMagicLinkUrl);
    }

    const { getProjectInvitationEmailHtml, getProjectInvitationEmailText } =
      await import('../../auth/emailTemplates.js');
    const { escapeHtml } = await import('../../lib/escapeHtml.js');

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
      invitation: true,
      message: 'Invitation sent successfully',
      email,
    },
    201,
  );
}

export { orgProjectMemberRoutes };
