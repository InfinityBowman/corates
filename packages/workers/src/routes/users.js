/**
 * User route handlers
 */

import { createDb } from '../db/client.js';
import { projects, projectMembers } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from '../auth/config.js';
import { jsonResponse, errorResponse } from '../middleware/cors.js';

/**
 * Handle user routes
 * - GET /api/users/:userId/projects - Get user's projects
 */
export async function handleUsers(request, env, path) {
  // User projects endpoint
  if (path.includes('/projects')) {
    const userId = path.split('/')[3];

    if (!userId) {
      return errorResponse('User ID required', 400, request);
    }

    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult;
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
