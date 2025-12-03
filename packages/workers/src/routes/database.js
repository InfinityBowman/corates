/**
 * Database routes for Hono
 * Handles database operations and migrations
 */

import { Hono } from 'hono';
import { createDb } from '../db/client.js';
import { user } from '../db/schema.js';
import { desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const dbRoutes = new Hono();

/**
 * GET /api/db/users
 * List users (requires auth)
 */
dbRoutes.get('/users', requireAuth, async (c) => {
  const db = createDb(c.env.DB);

  try {
    const results = await db
      .select({
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt))
      .limit(20);

    return c.json({ users: results });
  } catch (error) {
    console.error('Error fetching users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

/**
 * POST /api/db/users
 * Redirect to auth for user registration
 */
dbRoutes.post('/users', (c) => {
  return c.json({ error: 'Use /api/auth/register for user registration' }, 400);
});

/**
 * POST /api/db/migrate
 * Check migration status (public endpoint for development)
 */
dbRoutes.post('/migrate', async (c) => {
  try {
    // Check if tables exist (raw SQL for schema introspection)
    const tableCheck = await c.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user'",
    ).first();

    if (!tableCheck) {
      return c.json({
        success: false,
        message: 'Please run: pnpm db:migrate in the workers directory',
      });
    }

    return c.json({ success: true, message: 'Migration completed' });
  } catch (error) {
    console.error('Migration error:', error);
    return c.json({ error: 'Migration failed: ' + error.message }, 500);
  }
});

export { dbRoutes };
