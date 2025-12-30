/**
 * Org-scoped project invitation routes for Hono
 * Routes: /api/orgs/:orgId/projects/:projectId/invitations
 *
 * Combined invite flow: accepting ensures org membership then project membership
 */

import { Hono } from 'hono';
import { createDb } from '../../db/client.js';
import {
  projectInvitations,
  projectMembers,
  projects,
  user,
  member,
  organization,
} from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, getAuth } from '../../middleware/auth.js';
import {
  requireOrgMembership,
  requireProjectAccess,
  getOrgContext,
  getProjectContext,
} from '../../middleware/requireOrg.js';
import { invitationSchemas, validateRequest } from '../../config/validation.js';
import {
  createDomainError,
  PROJECT_ERRORS,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { syncMemberToDO } from '../../lib/project-sync.js';

const orgInvitationRoutes = new Hono();

// Apply auth middleware to all routes
orgInvitationRoutes.use('*', requireAuth);

/**
 * GET /api/orgs/:orgId/projects/:projectId/invitations
 * List pending invitations for a project
 */
orgInvitationRoutes.get('/', requireOrgMembership(), requireProjectAccess(), async c => {
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
      .where(eq(projectInvitations.projectId, projectId))
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
 * Invitation includes orgId so accepting ensures org membership first
 */
orgInvitationRoutes.post(
  '/',
  requireOrgMembership(),
  requireProjectAccess('owner'),
  validateRequest(invitationSchemas.create),
  async c => {
    const { user: authUser } = getAuth(c);
    const { orgId } = getOrgContext(c);
    const { projectId } = getProjectContext(c);
    const db = createDb(c.env.DB);

    try {
      const { email, role, orgRole } = c.get('validatedBody');

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
        // Resend existing invitation - update role and extend expiration
        invitationId = existingInvitation.id;
        token = existingInvitation.token;
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await db
          .update(projectInvitations)
          .set({ role, orgRole, expiresAt })
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
          orgRole,
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
  },
);

/**
 * DELETE /api/orgs/:orgId/projects/:projectId/invitations/:invitationId
 * Cancel a pending invitation (project owner only)
 */
orgInvitationRoutes.delete(
  '/:invitationId',
  requireOrgMembership(),
  requireProjectAccess('owner'),
  async c => {
    const { projectId } = getProjectContext(c);
    const invitationId = c.req.param('invitationId');
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
  },
);

/**
 * POST /api/orgs/:orgId/projects/:projectId/invitations/accept
 * Accept a project invitation by token
 * Combined flow: ensures org membership first, then adds project membership
 * Uses db.batch() for atomicity
 */
orgInvitationRoutes.post('/accept', validateRequest(invitationSchemas.accept), async c => {
  const { user: authUser } = getAuth(c);
  const db = createDb(c.env.DB);
  const { token } = c.get('validatedBody');

  try {
    // Find invitation by token (includes org fields for combined flow)
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

    // Execute atomically
    await db.batch(batchOps);

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
