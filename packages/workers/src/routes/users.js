/**
 * User route handlers
 */

import { createDb } from '../db/client.js';
import { projects, projectMembers, user } from '../db/schema.js';
import { eq, desc, or, like, and, notInArray } from 'drizzle-orm';
import { requireAuth } from '../auth/config.js';
import { jsonResponse, errorResponse } from '../middleware/cors.js';

/**
 * Handle user routes
 * - GET /api/users/search?q=query&projectId=xxx - Search users by name/email
 * - GET /api/users/:userId/projects - Get user's projects
 */
export async function handleUsers(request, env, path) {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  // User search endpoint: GET /api/users/search?q=query
  if (path === '/api/users/search') {
    return await searchUsers(request, env, authResult.user);
  }

  // User projects endpoint
  if (path.includes('/projects')) {
    const userId = path.split('/')[3];

    if (!userId) {
      return errorResponse('User ID required', 400, request);
    }

    // Only allow users to access their own projects
    if (authResult.user.id !== userId) {
      return errorResponse('Unauthorized', 403, request);
    }

    return await getUserProjects(request, env, userId);
  }

  return errorResponse('Not Found', 404, request);
}

/**
 * Search users by name or email
 * Query params:
 *   - q: search query (required, min 2 chars)
 *   - projectId: optional - exclude users already in this project
 *   - limit: max results (default 10, max 20)
 */
async function searchUsers(request, env, currentUser) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q')?.trim();
    const projectId = url.searchParams.get('projectId');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 20);

    if (!query || query.length < 2) {
      return errorResponse('Search query must be at least 2 characters', 400, request);
    }

    const db = createDb(env.DB);
    const searchPattern = `%${query.toLowerCase()}%`;

    // Build the query
    let baseQuery = db
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
          like(user.email, searchPattern),
          like(user.name, searchPattern),
          like(user.displayName, searchPattern),
          like(user.username, searchPattern),
        ),
      )
      .limit(limit);

    let results = await baseQuery;

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

    return jsonResponse(sanitizedResults, {}, request);
  } catch (error) {
    console.error('Error searching users:', error);
    return errorResponse('Failed to search users', 500, request);
  }
}

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
 * Get all projects for a user
 */
async function getUserProjects(request, env, userId) {
  try {
    const db = createDb(env.DB);

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

    return jsonResponse(results, {}, request);
  } catch (error) {
    console.error('Error fetching user projects:', error);
    return errorResponse('Failed to fetch projects', 500, request);
  }
}
