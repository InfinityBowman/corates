/**
 * Project CRUD route handlers
 */

import { createDb } from '../db/client.js';
import { projects, projectMembers, user } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../auth/config.js';
import { jsonResponse, errorResponse } from '../middleware/cors.js';

/**
 * Sync project metadata and members to the Durable Object
 */
async function syncProjectToDO(env, projectId, meta, members) {
  try {
    const doId = env.PROJECT_DOC.idFromName(projectId);
    const projectDoc = env.PROJECT_DOC.get(doId);

    await projectDoc.fetch(
      new Request('https://internal/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true',
        },
        body: JSON.stringify({ meta, members }),
      }),
    );
  } catch (err) {
    console.error('Failed to sync project to DO:', err);
  }
}

/**
 * Handle project routes
 * - GET /api/projects/:id - Get project details
 * - POST /api/projects - Create a new project
 * - PUT /api/projects/:id - Update project
 * - DELETE /api/projects/:id - Delete project
 */
export async function handleProjects(request, env, path) {
  const db = createDb(env.DB);

  // POST /api/projects - Create project
  if (path === '/api/projects' && request.method === 'POST') {
    return await createProject(request, env, db);
  }

  // Single project operations: /api/projects/:id
  const projectIdMatch = path.match(/^\/api\/projects\/([^/]+)$/);
  if (projectIdMatch) {
    const projectId = projectIdMatch[1];

    switch (request.method) {
      case 'GET':
        return await getProject(request, env, db, projectId);
      case 'PUT':
        return await updateProject(request, env, db, projectId);
      case 'DELETE':
        return await deleteProject(request, env, db, projectId);
      default:
        return errorResponse('Method not allowed', 405, request);
    }
  }

  return errorResponse('Not Found', 404, request);
}

/**
 * Get a single project by ID
 */
async function getProject(request, env, db, projectId) {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const result = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        role: projectMembers.role,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        createdBy: projects.createdBy,
      })
      .from(projects)
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(and(eq(projects.id, projectId), eq(projectMembers.userId, authResult.user.id)))
      .get();

    if (!result) {
      return errorResponse('Project not found or access denied', 404, request);
    }

    return jsonResponse(result, {}, request);
  } catch (error) {
    console.error('Error fetching project:', error);
    return errorResponse('Failed to fetch project', 500, request);
  }
}

/**
 * Create a new project
 */
async function createProject(request, env, db) {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const { name, description } = await request.json();

    if (!name || !name.trim()) {
      return errorResponse('Project name is required', 400, request);
    }

    const projectId = crypto.randomUUID();
    const now = new Date();

    // Create the project
    await db.insert(projects).values({
      id: projectId,
      name: name.trim(),
      description: description?.trim() || null,
      createdBy: authResult.user.id,
      createdAt: now,
      updatedAt: now,
    });

    // Add the creator as owner
    await db.insert(projectMembers).values({
      id: crypto.randomUUID(),
      projectId,
      userId: authResult.user.id,
      role: 'owner',
      joinedAt: now,
    });

    // Get creator's user info for DO sync
    const creator = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        displayName: user.displayName,
      })
      .from(user)
      .where(eq(user.id, authResult.user.id))
      .get();

    // Sync to Durable Object
    await syncProjectToDO(
      env,
      projectId,
      {
        name: name.trim(),
        description: description?.trim() || null,
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      },
      [
        {
          userId: authResult.user.id,
          role: 'owner',
          joinedAt: now.getTime(),
          name: creator?.name || null,
          email: creator?.email || null,
          displayName: creator?.displayName || null,
        },
      ],
    );

    const newProject = {
      id: projectId,
      name: name.trim(),
      description: description?.trim() || null,
      role: 'owner',
      createdAt: now,
      updatedAt: now,
    };

    return jsonResponse(newProject, { status: 201 }, request);
  } catch (error) {
    console.error('Error creating project:', error);
    return errorResponse('Failed to create project', 500, request);
  }
}

/**
 * Update project details
 */
async function updateProject(request, env, db, projectId) {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    // Check if user can edit
    const membership = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(
        and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, authResult.user.id)),
      )
      .get();

    if (!membership || !['owner', 'collaborator'].includes(membership.role)) {
      return errorResponse('Only owners and collaborators can update projects', 403, request);
    }

    const { name, description } = await request.json();
    const now = new Date();

    await db
      .update(projects)
      .set({
        name: name?.trim() || null,
        description: description?.trim() || null,
        updatedAt: now,
      })
      .where(eq(projects.id, projectId));

    // Sync updated meta to DO
    await syncProjectToDO(
      env,
      projectId,
      {
        name: name?.trim() || null,
        description: description?.trim() || null,
        updatedAt: now.getTime(),
      },
      null, // Don't update members
    );

    return jsonResponse({ success: true, projectId }, {}, request);
  } catch (error) {
    console.error('Error updating project:', error);
    return errorResponse('Failed to update project', 500, request);
  }
}

/**
 * Delete a project (owner only)
 */
async function deleteProject(request, env, db, projectId) {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    // Check if user is owner
    const membership = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(
        and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, authResult.user.id)),
      )
      .get();

    if (!membership || membership.role !== 'owner') {
      return errorResponse('Only project owners can delete projects', 403, request);
    }

    // Delete project (cascade will remove members)
    await db.delete(projects).where(eq(projects.id, projectId));

    return jsonResponse({ success: true, deleted: projectId }, {}, request);
  } catch (error) {
    console.error('Error deleting project:', error);
    return errorResponse('Failed to delete project', 500, request);
  }
}
