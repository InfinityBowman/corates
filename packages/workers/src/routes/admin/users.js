/**
 * Admin user management routes
 * Handles user CRUD operations, bans, impersonation, subscriptions, and stats
 */

import { Hono } from 'hono';
import { createDb } from '@/db/client.js';
import {
  user,
  session,
  projects,
  projectMembers,
  account,
  verification,
  twoFactor,
  mediaFiles,
  member,
  organization,
} from '@/db/schema.js';
import { eq, desc, sql, like, or, count } from 'drizzle-orm';
import { resolveOrgAccess } from '@/lib/billingResolver.js';
import { getPlan, getGrantPlan } from '@corates/shared/plans';
import { createAuth } from '@/auth/config.js';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  USER_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';
import { TIME_DURATIONS } from '@/config/constants.js';
import { syncMemberToDO } from '@/lib/project-sync.js';
import { userSchemas, validateRequest } from '@/config/validation.js';

const userRoutes = new Hono();

/**
 * GET /api/admin/stats
 * Get dashboard statistics
 */
userRoutes.get('/stats', async c => {
  const db = createDb(c.env.DB);

  try {
    // Get counts in parallel
    const [userCount, projectCount, sessionCount] = await Promise.all([
      db.select({ count: count() }).from(user),
      db.select({ count: count() }).from(projects),
      db.select({ count: count() }).from(session),
    ]);

    // Get recent signups (last 7 days)
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - TIME_DURATIONS.STATS_RECENT_DAYS_SEC;
    const [recentSignups] = await db
      .select({ count: count() })
      .from(user)
      .where(sql`${user.createdAt} > ${sevenDaysAgo}`);

    return c.json({
      users: userCount[0]?.count || 0,
      projects: projectCount[0]?.count || 0,
      activeSessions: sessionCount[0]?.count || 0,
      recentSignups: recentSignups?.count || 0,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_admin_stats',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /api/admin/users
 * List all users with pagination and search
 * Query params:
 *   - page: page number (default 1)
 *   - limit: results per page (default 20, max 100)
 *   - search: search by email or name
 *   - sort: field to sort by (default createdAt)
 *   - order: asc or desc (default desc)
 */
userRoutes.get('/users', async c => {
  const db = createDb(c.env.DB);

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
  const search = c.req.query('search')?.trim();
  const offset = (page - 1) * limit;

  try {
    let query = db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        displayName: user.displayName,
        username: user.username,
        image: user.image,
        avatarUrl: user.avatarUrl,
        role: user.role,
        emailVerified: user.emailVerified,
        banned: user.banned,
        banReason: user.banReason,
        banExpires: user.banExpires,
        stripeCustomerId: user.stripeCustomerId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user);

    // Apply search filter
    if (search) {
      const searchPattern = `%${search.toLowerCase()}%`;
      query = query.where(
        or(
          like(sql`lower(${user.email})`, searchPattern),
          like(sql`lower(${user.name})`, searchPattern),
          like(sql`lower(${user.displayName})`, searchPattern),
          like(sql`lower(${user.username})`, searchPattern),
        ),
      );
    }

    // Get total count for pagination
    const [totalResult] = await db
      .select({ count: count() })
      .from(user)
      .where(
        search ?
          or(
            like(sql`lower(${user.email})`, `%${search.toLowerCase()}%`),
            like(sql`lower(${user.name})`, `%${search.toLowerCase()}%`),
          )
        : undefined,
      );

    // Get paginated results
    const users = await query.orderBy(desc(user.createdAt)).limit(limit).offset(offset);

    // Fetch linked accounts for all users in the result set
    const userIds = users.map(u => u.id);
    let accountsMap = {};

    if (userIds.length > 0) {
      const accounts = await db
        .select({
          userId: account.userId,
          providerId: account.providerId,
        })
        .from(account)
        .where(
          sql`${account.userId} IN (${sql.join(
            userIds.map(id => sql`${id}`),
            sql`, `,
          )})`,
        );

      // Group accounts by userId
      accountsMap = accounts.reduce((acc, a) => {
        if (!acc[a.userId]) acc[a.userId] = [];
        acc[a.userId].push(a.providerId);
        return acc;
      }, {});
    }

    // Merge providers into user objects
    // Note: Billing is now org-scoped, not user-scoped. Check org memberships for billing info.
    const usersWithProviders = users.map(u => ({
      ...u,
      providers: accountsMap[u.id] || [],
    }));

    return c.json({
      users: usersWithProviders,
      pagination: {
        page,
        limit,
        total: totalResult?.count || 0,
        totalPages: Math.ceil((totalResult?.count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_users',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /api/admin/users/:userId
 * Get detailed user info
 */
userRoutes.get('/users/:userId', async c => {
  const userId = c.req.param('userId');
  const db = createDb(c.env.DB);

  try {
    const [userData] = await db.select().from(user).where(eq(user.id, userId)).limit(1);

    if (!userData) {
      const error = createDomainError(USER_ERRORS.NOT_FOUND, { userId });
      return c.json(error, error.statusCode);
    }

    // Get user's projects
    const userProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        role: projectMembers.role,
        joinedAt: projectMembers.joinedAt,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, userId));

    // Get user's active sessions
    const userSessions = await db
      .select({
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      })
      .from(session)
      .where(eq(session.userId, userId))
      .orderBy(desc(session.createdAt));

    // Get user's linked accounts
    const linkedAccounts = await db
      .select({
        id: account.id,
        providerId: account.providerId,
        accountId: account.accountId,
        createdAt: account.createdAt,
      })
      .from(account)
      .where(eq(account.userId, userId))
      .orderBy(desc(account.createdAt));

    // Get org memberships with billing info
    const orgMemberships = await db
      .select({
        orgId: member.organizationId,
        role: member.role,
        createdAt: member.createdAt,
        orgName: organization.name,
        orgSlug: organization.slug,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(eq(member.userId, userId))
      .orderBy(desc(member.createdAt));

    // Get billing info for each org
    const orgsWithBilling = await Promise.all(
      orgMemberships.map(async membership => {
        const orgBilling = await resolveOrgAccess(db, membership.orgId);
        const effectivePlan =
          orgBilling.source === 'grant' ?
            getGrantPlan(orgBilling.effectivePlanId)
          : getPlan(orgBilling.effectivePlanId);

        return {
          orgId: membership.orgId,
          orgName: membership.orgName,
          orgSlug: membership.orgSlug,
          role: membership.role,
          membershipCreatedAt: membership.createdAt,
          billing: {
            effectivePlanId: orgBilling.effectivePlanId,
            source: orgBilling.source,
            accessMode: orgBilling.accessMode,
            planName: effectivePlan.name,
          },
        };
      }),
    );

    return c.json({
      user: userData,
      projects: userProjects,
      sessions: userSessions,
      accounts: linkedAccounts,
      orgs: orgsWithBilling,
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_user_details',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST /api/admin/users/:userId/ban
 * Ban a user
 */
userRoutes.post('/users/:userId/ban', validateRequest(userSchemas.ban), async c => {
  const userId = c.req.param('userId');
  const { reason, expiresAt } = c.get('validatedBody');
  const db = createDb(c.env.DB);

  try {
    // Don't allow banning yourself
    const adminUser = c.get('user');
    if (adminUser.id === userId) {
      const error = createValidationError(
        'userId',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        userId,
        'cannot_ban_self',
      );
      return c.json(error, error.statusCode);
    }

    // Ban user and invalidate sessions atomically
    await db.batch([
      db
        .update(user)
        .set({
          banned: true,
          banReason: reason || 'Banned by administrator',
          banExpires: expiresAt ?? null,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId)),
      db.delete(session).where(eq(session.userId, userId)),
    ]);

    return c.json({ success: true, message: 'User banned successfully' });
  } catch (error) {
    console.error('Error banning user:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'ban_user',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST /api/admin/users/:userId/unban
 * Unban a user
 */
userRoutes.post('/users/:userId/unban', validateRequest(userSchemas.unban), async c => {
  const userId = c.req.param('userId');
  const db = createDb(c.env.DB);

  try {
    await db
      .update(user)
      .set({
        banned: false,
        banReason: null,
        banExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    return c.json({ success: true, message: 'User unbanned successfully' });
  } catch (error) {
    console.error('Error unbanning user:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'unban_user',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST /api/admin/users/:userId/impersonate
 * Start impersonating a user (creates a new session)
 * Requires user to have 'admin' role in database
 */
userRoutes.post('/users/:userId/impersonate', validateRequest(userSchemas.impersonate), async c => {
  const userId = c.req.param('userId');
  const adminUser = c.get('user');
  const body = c.get('validatedBody');

  try {
    // Don't allow impersonating yourself
    if (adminUser.id === userId) {
      const error = createValidationError(
        'userId',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        userId,
        'cannot_impersonate_self',
      );
      return c.json(error, error.statusCode);
    }

    // Use Better Auth's handler for impersonation to properly handle cookies
    const auth = createAuth(c.env, c.executionCtx);
    const url = new URL(c.req.url);

    // Create a request to Better Auth's impersonation endpoint
    const authUrl = new URL('/api/auth/admin/impersonate-user', url.origin);
    const cookie = c.req.raw.headers.get('cookie');
    const origin = c.req.raw.headers.get('origin');
    const referer = c.req.raw.headers.get('referer');
    const headers = new Headers();
    if (cookie) headers.set('cookie', cookie);
    if (origin) headers.set('origin', origin);
    if (referer) headers.set('referer', referer);
    headers.set('content-type', 'application/json');
    headers.set('accept', 'application/json');
    const authRequest = new Request(authUrl.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: body.userId }),
    });

    // Let Better Auth handle the request (this properly sets cookies)
    const response = await auth.handler(authRequest);

    if (response.status === 403 && c.env.ENVIRONMENT !== 'production') {
      try {
        const body = await response.clone().text();
        console.log('[Admin] Impersonation forbidden:', body);
      } catch {
        // ignore
      }
    }

    return response;
  } catch (error) {
    console.error('Error impersonating user:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'impersonate_user',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * DELETE /api/admin/users/:userId/sessions
 * Revoke all sessions for a user
 */
userRoutes.delete('/users/:userId/sessions', async c => {
  const userId = c.req.param('userId');
  const db = createDb(c.env.DB);

  try {
    await db.delete(session).where(eq(session.userId, userId));

    return c.json({ success: true, message: 'All sessions revoked' });
  } catch (error) {
    console.error('Error revoking sessions:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'revoke_sessions',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * DELETE /api/admin/users/:userId/sessions/:sessionId
 * Revoke a specific session for a user
 */
userRoutes.delete('/users/:userId/sessions/:sessionId', async c => {
  const userId = c.req.param('userId');
  const sessionId = c.req.param('sessionId');
  const db = createDb(c.env.DB);

  try {
    // Verify the session belongs to the user
    const [existingSession] = await db
      .select({ id: session.id, userId: session.userId })
      .from(session)
      .where(eq(session.id, sessionId))
      .limit(1);

    if (!existingSession) {
      const error = createDomainError(USER_ERRORS.NOT_FOUND, { sessionId });
      return c.json(error, error.statusCode);
    }

    // Verify session belongs to the specified user
    if (existingSession.userId !== userId) {
      const error = createDomainError(USER_ERRORS.NOT_FOUND, { sessionId });
      return c.json(error, error.statusCode);
    }

    await db.delete(session).where(eq(session.id, sessionId));

    return c.json({ success: true, message: 'Session revoked' });
  } catch (error) {
    console.error('Error revoking session:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'revoke_session',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete a user and all their data
 */
userRoutes.delete('/users/:userId', async c => {
  const userId = c.req.param('userId');
  const adminUser = c.get('user');
  const db = createDb(c.env.DB);

  try {
    // Don't allow deleting yourself
    if (adminUser.id === userId) {
      const error = createValidationError(
        'userId',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        userId,
        'cannot_delete_self',
      );
      return c.json(error, error.statusCode);
    }

    // Fetch user to get email for verification cleanup
    const [userToDelete] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId));
    if (!userToDelete) {
      const error = createDomainError(USER_ERRORS.NOT_FOUND, { userId });
      return c.json(error, error.statusCode);
    }

    // Fetch all projects the user is a member of before any deletions (with orgId)
    const userProjects = await db
      .select({
        projectId: projectMembers.projectId,
        orgId: projects.orgId,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, userId));

    // Sync all member removals to DOs atomically (fail fast if any fails)
    await Promise.all(
      userProjects.map(({ projectId }) => syncMemberToDO(c.env, projectId, 'remove', { userId })),
    );

    // Only proceed with database deletions if all DO syncs succeeded
    // Delete all user data atomically using batch transaction
    // Order matters for foreign key constraints
    // Update mediaFiles.uploadedBy to null before deleting user (following account-merge pattern)
    await db.batch([
      db.update(mediaFiles).set({ uploadedBy: null }).where(eq(mediaFiles.uploadedBy, userId)),
      db.delete(projectMembers).where(eq(projectMembers.userId, userId)),
      db.delete(projects).where(eq(projects.createdBy, userId)),
      db.delete(twoFactor).where(eq(twoFactor.userId, userId)),
      db.delete(session).where(eq(session.userId, userId)),
      db.delete(account).where(eq(account.userId, userId)),
      db.delete(verification).where(eq(verification.identifier, userToDelete.email)),
      db.delete(user).where(eq(user.id, userId)),
    ]);

    return c.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'delete_user',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { userRoutes };
