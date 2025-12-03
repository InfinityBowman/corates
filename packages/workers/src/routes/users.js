/**
 * User routes for Hono
 * Handles user operations including search and profile management
 */

import { Hono } from 'hono';
import { createDb } from '../db/client.js';
import { projects, projectMembers, user, session, account, verification } from '../db/schema.js';
import { eq, desc, or, like, sql } from 'drizzle-orm';
import { requireAuth, getAuth } from '../middleware/auth.js';

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
userRoutes.get('/search', async (c) => {
  const { user: currentUser } = getAuth(c);
  const query = c.req.query('q')?.trim();
  const projectId = c.req.query('projectId');
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 20);

  if (!query || query.length < 2) {
    return c.json({ error: 'Search query must be at least 2 characters' }, 400);
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

      const existingUserIds = new Set(existingMembers.map((m) => m.userId));
      results = results.filter((u) => !existingUserIds.has(u.id));
    }

    // Don't include the current user in search results
    results = results.filter((u) => u.id !== currentUser.id);

    // Sanitize results - don't expose full email to non-matching queries
    const sanitizedResults = results.map((u) => ({
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
    return c.json({ error: 'Failed to search users' }, 500);
  }
});

/**
 * GET /api/users/:userId/projects
 * Get all projects for a user
 */
userRoutes.get('/:userId/projects', async (c) => {
  const { user: authUser } = getAuth(c);
  const userId = c.req.param('userId');

  // Only allow users to access their own projects
  if (authUser.id !== userId) {
    return c.json({ error: 'Unauthorized' }, 403);
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
    return c.json({ error: 'Failed to fetch projects' }, 500);
  }
});

/**
 * DELETE /api/users/me
 * Delete current user's account and all associated data
 */
userRoutes.delete('/me', async (c) => {
  const { user: currentUser } = getAuth(c);
  const db = createDb(c.env.DB);
  const userId = currentUser.id;

  try {
    // Delete in order to respect foreign key constraints
    // 1. Delete project memberships
    await db.delete(projectMembers).where(eq(projectMembers.userId, userId));

    // 2. Delete projects where user is the creator
    await db.delete(projects).where(eq(projects.createdBy, userId));

    // 3. Delete verifications
    await db.delete(verification).where(eq(verification.identifier, currentUser.email));

    // 4. Delete accounts (OAuth/password)
    await db.delete(account).where(eq(account.userId, userId));

    // 5. Delete sessions
    await db.delete(session).where(eq(session.userId, userId));

    // 6. Finally, delete the user
    await db.delete(user).where(eq(user.id, userId));

    console.log(`Account deleted successfully for user: ${userId}`);

    return c.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    return c.json({ error: 'Failed to delete account' }, 500);
  }
});

export { userRoutes };
