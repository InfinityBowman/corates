/**
 * Database routes for Hono
 * Handles database operations and migrations
 */

import { Hono } from 'hono';
import { createDb } from '@/db/client.js';
import { user } from '@/db/schema.js';
import { desc } from 'drizzle-orm';
import { requireAuth } from '@/middleware/auth.js';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';

const dbRoutes = new Hono();

/**
 * GET /api/db/users
 * List users (requires auth)
 */
dbRoutes.get('/users', requireAuth, async c => {
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
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_users',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST /api/db/users
 * Redirect to auth for user registration
 */
dbRoutes.post('/users', c => {
  const error = createValidationError(
    'endpoint',
    VALIDATION_ERRORS.INVALID_INPUT.code,
    null,
    'use_auth_register',
  );
  return c.json(error, error.statusCode);
});

/**
 * POST /api/db/migrate
 * Check migration status (public endpoint for development)
 */
dbRoutes.post('/migrate', async c => {
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
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'check_migration',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { dbRoutes };
