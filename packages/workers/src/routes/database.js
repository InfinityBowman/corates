/**
 * Database/migration route handlers
 */

import { createDb } from '../db/client.js';
import { user } from '../db/schema.js';
import { desc } from 'drizzle-orm';
import { jsonResponse, errorResponse } from '../middleware/cors.js';

/**
 * Handle database routes
 * - GET /api/db/users - List users (requires auth)
 * - POST /api/db/migrate - Check migration status
 */
export async function handleDatabase(request, env, path, authUser = null) {
  const db = createDb(env.DB);

  // GET /api/db/users - List users
  if (path === '/api/db/users' && request.method === 'GET') {
    if (!authUser) {
      return errorResponse('Authentication required', 401, request);
    }

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

      return jsonResponse({ users: results }, {}, request);
    } catch (error) {
      console.error('Error fetching users:', error);
      return errorResponse('Failed to fetch users', 500, request);
    }
  }

  // POST /api/db/users - Redirect to auth
  if (path === '/api/db/users' && request.method === 'POST') {
    return errorResponse('Use /api/auth/register for user registration', 400, request);
  }

  // POST /api/db/migrate - Check migration status
  if (path === '/api/db/migrate' && request.method === 'POST') {
    try {
      // Check if tables exist (raw SQL for schema introspection)
      const tableCheck = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user'").first();

      if (!tableCheck) {
        return jsonResponse(
          {
            success: false,
            message: 'Please run: pnpm db:migrate in the workers directory',
          },
          {},
          request,
        );
      }

      return jsonResponse({ success: true, message: 'Migration completed' }, {}, request);
    } catch (error) {
      console.error('Migration error:', error);
      return errorResponse('Migration failed: ' + error.message, 500, request);
    }
  }

  return errorResponse('Database operation not implemented', 501, request);
}
