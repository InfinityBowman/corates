/**
 * Project routes for Hono
 * Handles project CRUD operations
 */

import { Hono } from 'hono';
import { createDb } from '../db/client.js';
import { projects, projectMembers, user } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { projectSchemas, validateRequest } from '../config/validation.js';
import { createErrorResponse, ERROR_CODES, EDIT_ROLES } from '../config/constants.js';

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
      return c.json(createErrorResponse(ERROR_CODES.PROJECT_NOT_FOUND), 404);
    }

    return c.json(result);
  } catch (error) {
    console.error('Error fetching project:', error);
    return c.json(createErrorResponse(ERROR_CODES.DB_ERROR, error.message), 500);
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
projectRoutes.post('/', validateRequest(projectSchemas.create), async c => {
  const { user: authUser } = getAuth(c);
  const db = createDb(c.env.DB);
  const { name, description } = c.get('validatedBody');

  const projectId = crypto.randomUUID();
  const now = new Date();

  try {
    // Use D1 batch for transaction-like behavior
    // D1 doesn't support true transactions, but batch ensures atomicity
    const statements = [
      c.env.DB.prepare(
        'INSERT INTO projects (id, name, description, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      ).bind(
        projectId,
        name,
        description,
        authUser.id,
        Math.floor(now.getTime() / 1000),
        Math.floor(now.getTime() / 1000),
      ),
      c.env.DB.prepare(
        'INSERT INTO project_members (id, projectId, userId, role, joinedAt) VALUES (?, ?, ?, ?, ?)',
      ).bind(
        crypto.randomUUID(),
        projectId,
        authUser.id,
        'owner',
        Math.floor(now.getTime() / 1000),
      ),
    ];

    await c.env.DB.batch(statements);

    // Get creator's user info for DO sync
    const creator = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        displayName: user.displayName,
        image: user.image,
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
          image: creator?.image || null,
        },
      ],
    );

    const newProject = {
      id: projectId,
      name,
      description,
      role: 'owner',
      createdAt: now,
      updatedAt: now,
    };

    return c.json(newProject, 201);
  } catch (error) {
    console.error('Error creating project:', error);
    return c.json(createErrorResponse(ERROR_CODES.DB_TRANSACTION_FAILED, error.message), 500);
  }
});

/**
 * PUT /api/projects/:id
 * Update project details
 */
projectRoutes.put('/:id', validateRequest(projectSchemas.update), async c => {
  const { user: authUser } = getAuth(c);
  const projectId = c.req.param('id');
  const db = createDb(c.env.DB);
  const { name, description } = c.get('validatedBody');

  try {
    // Check if user can edit
    const membership = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, authUser.id)))
      .get();

    if (!membership || !EDIT_ROLES.includes(membership.role)) {
      return c.json(
        createErrorResponse(
          ERROR_CODES.AUTH_FORBIDDEN,
          'Only owners and collaborators can update projects',
        ),
        403,
      );
    }

    const now = new Date();

    // Only update fields that are provided
    const updateData = { updatedAt: now };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    await db.update(projects).set(updateData).where(eq(projects.id, projectId));

    // Sync updated meta to DO (only include provided fields)
    const metaUpdate = { updatedAt: now.getTime() };
    if (name !== undefined) metaUpdate.name = name;
    if (description !== undefined) metaUpdate.description = description;

    await syncProjectToDO(c.env, projectId, metaUpdate, null);

    return c.json({ success: true, projectId });
  } catch (error) {
    console.error('Error updating project:', error);
    return c.json(createErrorResponse(ERROR_CODES.DB_ERROR, error.message), 500);
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
      return c.json(
        createErrorResponse(ERROR_CODES.AUTH_FORBIDDEN, 'Only project owners can delete projects'),
        403,
      );
    }

    // Delete project (cascade will remove members)
    await db.delete(projects).where(eq(projects.id, projectId));

    return c.json({ success: true, deleted: projectId });
  } catch (error) {
    console.error('Error deleting project:', error);
    return c.json(createErrorResponse(ERROR_CODES.DB_ERROR, error.message), 500);
  }
});

export { projectRoutes };
