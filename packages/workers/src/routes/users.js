/**
 * User routes for Hono
 * Handles user operations including search and profile management
 */

import { Hono } from 'hono';
import { createDb } from '../db/client.js';
import {
  projects,
  projectMembers,
  user,
  session,
  account,
  verification,
  twoFactor,
  subscriptions,
} from '../db/schema.js';
import { eq, desc, or, like, sql } from 'drizzle-orm';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { searchRateLimit } from '../middleware/rateLimit.js';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  AUTH_ERRORS,
  USER_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';
import { syncMemberToDO } from '../lib/project-sync.js';

const userRoutes = new Hono();

// Apply auth middleware to all routes
userRoutes.use('*', requireAuth);

/**
 * Mask email for privacy (show first 2 chars and domain)
 */
function maskEmail(email) {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const masked = local.length > 2 ? local.slice(0, 2) + '***' : local + '***';
  return `${masked}@${domain}`;
}

/**
 * GET /api/users/search
 * Search users by name or email
 * Query params:
 *   - q: search query (required, min 2 chars)
 *   - projectId: optional - exclude users already in this project
 *   - limit: max results (default 10, max 20)
 */
userRoutes.get('/search', searchRateLimit, async c => {
  const { user: currentUser } = getAuth(c);
  const query = c.req.query('q')?.trim();
  const projectId = c.req.query('projectId');
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 20);

  if (!query || query.length < 2) {
    const error = createValidationError(
      'query',
      VALIDATION_ERRORS.FIELD_TOO_SHORT.code,
      query,
      'min_length',
    );
    return c.json(error, error.statusCode);
  }

  const db = createDb(c.env.DB);
  const searchPattern = `%${query.toLowerCase()}%`;

  try {
    // Build the query - use lower() for case-insensitive search
    let results = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        image: user.image,
      })
      .from(user)
      .where(
        or(
          like(sql`lower(${user.email})`, searchPattern),
          like(sql`lower(${user.name})`, searchPattern),
          like(sql`lower(${user.displayName})`, searchPattern),
          like(sql`lower(${user.username})`, searchPattern),
        ),
      )
      .limit(limit);

    // If projectId provided, filter out users already in the project
    if (projectId) {
      const existingMembers = await db
        .select({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(eq(projectMembers.projectId, projectId));

      const existingUserIds = new Set(existingMembers.map(m => m.userId));
      results = results.filter(u => !existingUserIds.has(u.id));
    }

    // Don't include the current user in search results
    results = results.filter(u => u.id !== currentUser.id);

    // Sanitize results - don't expose full email to non-matching queries
    const sanitizedResults = results.map(u => ({
      id: u.id,
      name: u.name,
      displayName: u.displayName,
      username: u.username,
      image: u.image,
      // Only show email if query matches email pattern
      email: query.includes('@') ? u.email : maskEmail(u.email),
    }));

    return c.json(sanitizedResults);
  } catch (error) {
    console.error('Error searching users:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'search_users',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /api/users/:userId/projects
 * Get all projects for a user
 */
userRoutes.get('/:userId/projects', async c => {
  const { user: authUser } = getAuth(c);
  const userId = c.req.param('userId');

  // Only allow users to access their own projects
  if (authUser.id !== userId) {
    const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
      reason: 'view_other_user_projects',
    });
    return c.json(error, error.statusCode);
  }

  const db = createDb(c.env.DB);

  try {
    const results = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        role: projectMembers.role,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(eq(projectMembers.userId, userId))
      .orderBy(desc(projects.updatedAt));

    return c.json(results);
  } catch (error) {
    console.error('Error fetching user projects:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_user_projects',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * DELETE /api/users/me
 * Delete current user's account and all associated data
 */
userRoutes.delete('/me', async c => {
  const { user: currentUser } = getAuth(c);
  const db = createDb(c.env.DB);
  const userId = currentUser.id;

  try {
    // Fetch all projects the user is a member of before any deletions
    const userProjects = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId));

    // Sync all member removals to DOs atomically (fail fast if any fails)
    await Promise.all(
      userProjects.map(({ projectId }) => syncMemberToDO(c.env, projectId, 'remove', { userId })),
    );

    // Only proceed with database deletions if all DO syncs succeeded
    // Delete all user data atomically using batch transaction
    // Order matters for foreign key constraints
    await db.batch([
      db.delete(projectMembers).where(eq(projectMembers.userId, userId)),
      db.delete(projects).where(eq(projects.createdBy, userId)),
      db.delete(subscriptions).where(eq(subscriptions.userId, userId)),
      db.delete(twoFactor).where(eq(twoFactor.userId, userId)),
      db.delete(session).where(eq(session.userId, userId)),
      db.delete(account).where(eq(account.userId, userId)),
      db.delete(verification).where(eq(verification.identifier, currentUser.email)),
      db.delete(user).where(eq(user.id, userId)),
    ]);

    console.log(`Account deleted successfully for user: ${userId}`);

    return c.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'delete_account',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST /api/users/sync-profile
 * Sync the current user's profile changes to all their project memberships
 * This ensures name/displayName/image updates propagate to Y.js docs
 */
userRoutes.post('/sync-profile', async c => {
  const { user: currentUser } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    // Get fresh user data from DB
    const [userData] = await db
      .select({
        name: user.name,
        displayName: user.displayName,
        image: user.image,
      })
      .from(user)
      .where(eq(user.id, currentUser.id))
      .limit(1);

    if (!userData) {
      const error = createDomainError(USER_ERRORS.NOT_FOUND, { userId: currentUser.id });
      return c.json(error, error.statusCode);
    }

    // Get all projects this user is a member of
    const userProjects = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, currentUser.id));

    // Sync to each project's Durable Object
    const syncPromises = userProjects.map(async ({ projectId }) => {
      try {
        const doId = c.env.PROJECT_DOC.idFromName(projectId);
        const projectDoc = c.env.PROJECT_DOC.get(doId);

        await projectDoc.fetch(
          new Request('https://internal/sync-member', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Request': 'true',
            },
            body: JSON.stringify({
              action: 'update',
              member: {
                userId: currentUser.id,
                name: userData.name,
                displayName: userData.displayName,
                image: userData.image,
              },
            }),
          }),
        );
        return { projectId, success: true };
      } catch (err) {
        console.error(`Failed to sync profile to project ${projectId}:`, err);
        return { projectId, success: false, error: err.message };
      }
    });

    const results = await Promise.all(syncPromises);
    const successCount = results.filter(r => r.success).length;

    return c.json({
      success: true,
      synced: successCount,
      total: userProjects.length,
    });
  } catch (error) {
    console.error('Error syncing profile:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'sync_profile',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { userRoutes };
