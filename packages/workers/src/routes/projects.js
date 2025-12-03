/**
 * Project routes for Hono
 * Handles project CRUD operations
 */

import { Hono } from 'hono';
import { createDb } from '../db/client.js';
import { projects, projectMembers, user } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, getAuth } from '../middleware/auth.js';

const projectRoutes = new Hono();

// Apply auth middleware to all routes
projectRoutes.use('*', requireAuth);

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
 * GET /api/projects/:id
 * Get a single project by ID
 */
projectRoutes.get('/:id', async c => {
  const { user: authUser } = getAuth(c);
  const projectId = c.req.param('id');
  const db = createDb(c.env.DB);

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
      .where(and(eq(projects.id, projectId), eq(projectMembers.userId, authUser.id)))
      .get();

    if (!result) {
      return c.json({ error: 'Project not found or access denied' }, 404);
    }

    return c.json(result);
  } catch (error) {
    console.error('Error fetching project:', error);
    return c.json({ error: 'Failed to fetch project' }, 500);
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
projectRoutes.post('/', async c => {
  const { user: authUser } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    const { name, description } = await c.req.json();

    if (!name || !name.trim()) {
      return c.json({ error: 'Project name is required' }, 400);
    }

    const projectId = crypto.randomUUID();
    const now = new Date();

    // Create the project
    await db.insert(projects).values({
      id: projectId,
      name: name.trim(),
      description: description?.trim() || null,
      createdBy: authUser.id,
      createdAt: now,
      updatedAt: now,
    });

    // Add the creator as owner
    await db.insert(projectMembers).values({
      id: crypto.randomUUID(),
      projectId,
      userId: authUser.id,
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
      .where(eq(user.id, authUser.id))
      .get();

    // Sync to Durable Object
    await syncProjectToDO(
      c.env,
      projectId,
      {
        name: name.trim(),
        description: description?.trim() || null,
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      },
      [
        {
          userId: authUser.id,
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

    return c.json(newProject, 201);
  } catch (error) {
    console.error('Error creating project:', error);
    return c.json({ error: 'Failed to create project' }, 500);
  }
});

/**
 * PUT /api/projects/:id
 * Update project details
 */
projectRoutes.put('/:id', async c => {
  const { user: authUser } = getAuth(c);
  const projectId = c.req.param('id');
  const db = createDb(c.env.DB);

  try {
    // Check if user can edit
    const membership = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, authUser.id)))
      .get();

    if (!membership || !['owner', 'collaborator'].includes(membership.role)) {
      return c.json({ error: 'Only owners and collaborators can update projects' }, 403);
    }

    const { name, description } = await c.req.json();
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
      c.env,
      projectId,
      {
        name: name?.trim() || null,
        description: description?.trim() || null,
        updatedAt: now.getTime(),
      },
      null,
    );

    return c.json({ success: true, projectId });
  } catch (error) {
    console.error('Error updating project:', error);
    return c.json({ error: 'Failed to update project' }, 500);
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project (owner only)
 */
projectRoutes.delete('/:id', async c => {
  const { user: authUser } = getAuth(c);
  const projectId = c.req.param('id');
  const db = createDb(c.env.DB);

  try {
    // Check if user is owner
    const membership = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, authUser.id)))
      .get();

    if (!membership || membership.role !== 'owner') {
      return c.json({ error: 'Only project owners can delete projects' }, 403);
    }

    // Delete project (cascade will remove members)
    await db.delete(projects).where(eq(projects.id, projectId));

    return c.json({ success: true, deleted: projectId });
  } catch (error) {
    console.error('Error deleting project:', error);
    return c.json({ error: 'Failed to delete project' }, 500);
  }
});

export { projectRoutes };
