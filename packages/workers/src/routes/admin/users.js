/**
 * Admin user management routes
 * Handles user CRUD operations, bans, impersonation, subscriptions, and stats
 */

import { Hono } from 'hono';
import { createDb } from '../../db/client.js';
import {
  user,
  session,
  projects,
  projectMembers,
  account,
  verification,
  twoFactor,
  subscriptions,
} from '../../db/schema.js';
import { eq, desc, sql, like, or, count } from 'drizzle-orm';
import { createAuth } from '../../auth/config.js';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  USER_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';
import { upsertSubscription, getSubscriptionByUserId } from '../../db/subscriptions.js';
import { getPlan } from '@corates/shared/plans';
import { subscriptionSchemas, validateRequest } from '../../config/validation.js';

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
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
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

    // Fetch linked accounts and subscriptions for all users in the result set
    const userIds = users.map(u => u.id);
    let accountsMap = {};
    let subscriptionsMap = {};

    if (userIds.length > 0) {
      const [accounts, userSubscriptions] = await Promise.all([
        db
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
          ),
        db
          .select()
          .from(subscriptions)
          .where(
            sql`${subscriptions.userId} IN (${sql.join(
              userIds.map(id => sql`${id}`),
              sql`, `,
            )})`,
          ),
      ]);

      // Group accounts by userId
      accountsMap = accounts.reduce((acc, a) => {
        if (!acc[a.userId]) acc[a.userId] = [];
        acc[a.userId].push(a.providerId);
        return acc;
      }, {});

      // Group subscriptions by userId
      subscriptionsMap = userSubscriptions.reduce((acc, s) => {
        acc[s.userId] = s;
        return acc;
      }, {});
    }

    // Merge providers and subscriptions into user objects
    const usersWithProviders = users.map(u => ({
      ...u,
      providers: accountsMap[u.id] || [],
      subscription: subscriptionsMap[u.id] || null,
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

    // Get user's subscription/access
    const [userSubscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    return c.json({
      user: userData,
      projects: userProjects,
      sessions: userSessions,
      accounts: linkedAccounts,
      subscription: userSubscription || null,
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
userRoutes.post('/users/:userId/ban', async c => {
  const userId = c.req.param('userId');
  const { reason, expiresAt } = await c.req.json();
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
          banExpires: expiresAt ? new Date(expiresAt) : null,
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
userRoutes.post('/users/:userId/unban', async c => {
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
userRoutes.post('/users/:userId/impersonate', async c => {
  const userId = c.req.param('userId');
  const adminUser = c.get('user');

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
      body: JSON.stringify({ userId }),
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

    // Delete all user data atomically using batch transaction
    // Order matters for foreign key constraints
    await db.batch([
      db.delete(projectMembers).where(eq(projectMembers.userId, userId)),
      db.delete(projects).where(eq(projects.createdBy, userId)),
      db.delete(subscriptions).where(eq(subscriptions.userId, userId)),
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

/**
 * GET /api/admin/check
 * Check if current user is admin
 */
userRoutes.get('/check', async c => {
  const adminUser = c.get('user');
  return c.json({
    isAdmin: true,
    user: {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
    },
  });
});

/**
 * POST /api/admin/users/:userId/subscription
 * Grant or update subscription for a user
 * Body: { tier: 'free'|'pro'|'unlimited', status: 'active', currentPeriodStart?: timestamp, currentPeriodEnd?: timestamp }
 * Admins select the plan (tier), which determines entitlements/quotas via configuration
 */
userRoutes.post(
  '/users/:userId/subscription',
  validateRequest(subscriptionSchemas.grant),
  async c => {
    const userId = c.req.param('userId');
    const db = createDb(c.env.DB);

    try {
      const { tier, currentPeriodStart, currentPeriodEnd } = c.get('validatedBody');
      // status is validated by Zod schema to be 'active', so we can use it directly

      // Validate user exists
      const [userData] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
      if (!userData) {
        const error = createDomainError(USER_ERRORS.NOT_FOUND, { userId });
        return c.json(error, error.statusCode);
      }

      // Convert timestamps if provided (expecting seconds, but handle both)
      let periodStart = currentPeriodStart;
      let periodEnd = currentPeriodEnd;

      if (periodStart && typeof periodStart === 'number') {
        // If timestamp is in milliseconds, convert to seconds
        if (periodStart > 1000000000000) {
          periodStart = Math.floor(periodStart / 1000);
        }
      }

      if (periodEnd !== null && periodEnd !== undefined && typeof periodEnd === 'number') {
        // If timestamp is in milliseconds, convert to seconds
        if (periodEnd > 1000000000000) {
          periodEnd = Math.floor(periodEnd / 1000);
        }
      }

      // Create or update subscription
      const subscriptionId = crypto.randomUUID();
      const subscription = await upsertSubscription(db, {
        id: subscriptionId,
        userId,
        tier,
        status: 'active',
        currentPeriodStart: periodStart ? new Date(periodStart * 1000) : new Date(),
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      });

      // Get plan info for response
      const plan = getPlan(tier);

      return c.json({
        success: true,
        message: 'Subscription granted successfully',
        subscription,
        plan: {
          id: tier,
          name: plan.name,
          entitlements: plan.entitlements,
          quotas: plan.quotas,
        },
      });
    } catch (error) {
      console.error('Error granting access:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'grant_access',
        originalError: error.message,
      });
      return c.json(dbError, dbError.statusCode);
    }
  },
);

/**
 * DELETE /api/admin/users/:userId/subscription
 * Revoke subscription for a user (sets status to inactive)
 */
userRoutes.delete('/users/:userId/subscription', async c => {
  const userId = c.req.param('userId');
  const db = createDb(c.env.DB);

  try {
    // Validate user exists
    const [userData] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
    if (!userData) {
      const error = createDomainError(USER_ERRORS.NOT_FOUND, { userId });
      return c.json(error, error.statusCode);
    }

    // Get existing subscription
    const existing = await getSubscriptionByUserId(db, userId);

    if (existing) {
      // Set status to inactive instead of deleting (preserves history)
      await db
        .update(subscriptions)
        .set({
          status: 'inactive',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.userId, userId));
    }

    return c.json({
      success: true,
      message: 'Subscription revoked successfully',
    });
  } catch (error) {
    console.error('Error revoking access:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'revoke_access',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { userRoutes };
