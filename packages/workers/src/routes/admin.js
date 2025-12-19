/**
 * Admin routes for Hono
 * Provides admin dashboard API endpoints for user management
 */

import { Hono } from 'hono';
import { createDb } from '../db/client.js';
import {
  user,
  session,
  projects,
  projectMembers,
  account,
  verification,
  twoFactor,
  subscriptions,
} from '../db/schema.js';
import { eq, desc, sql, like, or, count } from 'drizzle-orm';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireTrustedOrigin } from '../middleware/csrf.js';
import { createAuth } from '../auth/config.js';
const adminRoutes = new Hono();

// Apply admin middleware to all routes
adminRoutes.use('*', requireAdmin);
// CSRF guard for all state-changing admin routes
adminRoutes.use('*', requireTrustedOrigin);

/**
 * GET /api/admin/stats
 * Get dashboard statistics
 */
adminRoutes.get('/stats', async c => {
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
    return c.json({ error: 'Failed to fetch statistics' }, 500);
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
adminRoutes.get('/users', async c => {
  const db = createDb(c.env.DB);

  const page = Math.max(1, Number.parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, Number.parseInt(c.req.query('limit') || '20', 10)));
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
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

/**
 * GET /api/admin/users/:userId
 * Get detailed user info
 */
adminRoutes.get('/users/:userId', async c => {
  const userId = c.req.param('userId');
  const db = createDb(c.env.DB);

  try {
    const [userData] = await db.select().from(user).where(eq(user.id, userId)).limit(1);

    if (!userData) {
      return c.json({ error: 'User not found' }, 404);
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

    return c.json({
      user: userData,
      projects: userProjects,
      sessions: userSessions,
      accounts: linkedAccounts,
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    return c.json({ error: 'Failed to fetch user details' }, 500);
  }
});

/**
 * POST /api/admin/users/:userId/ban
 * Ban a user
 */
adminRoutes.post('/users/:userId/ban', async c => {
  const userId = c.req.param('userId');
  const { reason, expiresAt } = await c.req.json();
  const db = createDb(c.env.DB);

  try {
    // Don't allow banning yourself
    const adminUser = c.get('user');
    if (adminUser.id === userId) {
      return c.json({ error: 'Cannot ban yourself' }, 400);
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
    return c.json({ error: 'Failed to ban user' }, 500);
  }
});

/**
 * POST /api/admin/users/:userId/unban
 * Unban a user
 */
adminRoutes.post('/users/:userId/unban', async c => {
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
    return c.json({ error: 'Failed to unban user' }, 500);
  }
});

/**
 * POST /api/admin/users/:userId/impersonate
 * Start impersonating a user (creates a new session)
 * Requires user to have 'admin' role in database
 */
adminRoutes.post('/users/:userId/impersonate', async c => {
  const userId = c.req.param('userId');
  const adminUser = c.get('user');

  try {
    // Don't allow impersonating yourself
    if (adminUser.id === userId) {
      return c.json({ error: 'Cannot impersonate yourself' }, 400);
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
    return c.json({ error: 'Failed to impersonate user' }, 500);
  }
});

// Note: stop-impersonation is defined in index.js separately
// because it needs to bypass the requireAdmin middleware
// (the impersonated user won't have admin role)

/**
 * DELETE /api/admin/users/:userId/sessions
 * Revoke all sessions for a user
 */
adminRoutes.delete('/users/:userId/sessions', async c => {
  const userId = c.req.param('userId');
  const db = createDb(c.env.DB);

  try {
    await db.delete(session).where(eq(session.userId, userId));

    return c.json({ success: true, message: 'All sessions revoked' });
  } catch (error) {
    console.error('Error revoking sessions:', error);
    return c.json({ error: 'Failed to revoke sessions' }, 500);
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete a user and all their data
 */
adminRoutes.delete('/users/:userId', async c => {
  const userId = c.req.param('userId');
  const adminUser = c.get('user');
  const db = createDb(c.env.DB);

  try {
    // Don't allow deleting yourself
    if (adminUser.id === userId) {
      return c.json({ error: 'Cannot delete yourself' }, 400);
    }

    // Fetch user to get email for verification cleanup
    const [userToDelete] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId));
    if (!userToDelete) {
      return c.json({ error: 'User not found' }, 404);
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
    return c.json({ error: 'Failed to delete user' }, 500);
  }
});

/**
 * GET /api/admin/check
 * Check if current user is admin
 */
adminRoutes.get('/check', async c => {
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

export { adminRoutes };
