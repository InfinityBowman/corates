/**
 * Project routes for Hono
 * Handles project CRUD operations
 */

import { Hono } from 'hono';
import { createDb } from '../db/client.js';
import { projects, projectMembers, user } from '../db/schema.js';
import { eq, and, count } from 'drizzle-orm';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { requireEntitlement } from '../middleware/requireEntitlement.js';
import { requireQuota } from '../middleware/requireQuota.js';
import { projectSchemas, validateRequest } from '../config/validation.js';
import { EDIT_ROLES } from '../config/constants.js';
import { createDomainError, PROJECT_ERRORS, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';

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
      const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
      return c.json(error, error.statusCode);
    }

    return c.json(result);
  } catch (error) {
    console.error('Error fetching project:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_project',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * Helper to get current project count for user
 * Used for quota checking
 */
async function getProjectCount(c, user) {
  const db = createDb(c.env.DB);
  const [result] = await db
    .select({ count: count() })
    .from(projects)
    .where(eq(projects.createdBy, user.id));
  return result?.count || 0;
}

/**
 * POST /api/projects
 * Create a new project
 * Requires 'project.create' entitlement and 'projects.max' quota
 */
projectRoutes.post(
  '/',
  requireEntitlement('project.create'),
  requireQuota('projects.max', getProjectCount, 1),
  validateRequest(projectSchemas.create),
  async c => {
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
      const dbError = createDomainError(SYSTEM_ERRORS.DB_TRANSACTION_FAILED, {
        operation: 'create_project',
        originalError: error.message,
      });
      return c.json(dbError, dbError.statusCode);
    }
  },
);

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
      const error = createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'update_project' },
        'Only owners and collaborators can update projects',
      );
      return c.json(error, error.statusCode);
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
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_project',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
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
      const error = createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'delete_project' },
        'Only project owners can delete projects',
      );
      return c.json(error, error.statusCode);
    }

    // Get project name and all members before deletion (for notifications)
    const project = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    const members = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId))
      .all();

    // Disconnect all connected users from the ProjectDoc DO
    try {
      const doId = c.env.PROJECT_DOC.idFromName(projectId);
      const projectDoc = c.env.PROJECT_DOC.get(doId);
      await projectDoc.fetch(
        new Request('https://internal/disconnect-all', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Request': 'true',
          },
        }),
      );
    } catch (err) {
      console.error('Failed to disconnect users from DO:', err);
    }

    // Clean up all PDFs from R2 storage for this project
    try {
      const prefix = `projects/${projectId}/`;
      let cursor = undefined;
      let deletedCount = 0;

      // R2 list returns max 1000 objects at a time, so we need to paginate
      do {
        const listed = await c.env.PDF_BUCKET.list({ prefix, cursor });

        if (listed.objects.length > 0) {
          // Delete objects in batches
          const keysToDelete = listed.objects.map(obj => obj.key);
          await Promise.all(keysToDelete.map(key => c.env.PDF_BUCKET.delete(key)));
          deletedCount += keysToDelete.length;
        }

        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);

      if (deletedCount > 0) {
        console.log(`Deleted ${deletedCount} R2 objects for project ${projectId}`);
      }
    } catch (err) {
      console.error('Failed to clean up R2 files for project:', projectId, err);
      // Continue with deletion even if R2 cleanup fails
    }

    // Delete project (cascade will remove members)
    await db.delete(projects).where(eq(projects.id, projectId));

    // Send notifications to all members (except the one who deleted)
    for (const member of members) {
      if (member.userId !== authUser.id) {
        try {
          const userSessionId = c.env.USER_SESSION.idFromName(member.userId);
          const userSession = c.env.USER_SESSION.get(userSessionId);
          await userSession.fetch(
            new Request('https://internal/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'project-deleted',
                projectId,
                projectName: project?.name || 'Unknown Project',
                deletedBy: authUser.name || authUser.email,
                timestamp: Date.now(),
              }),
            }),
          );
        } catch (err) {
          console.error('Failed to send deletion notification to user:', member.userId, err);
        }
      }
    }

    return c.json({ success: true, deleted: projectId });
  } catch (error) {
    console.error('Error deleting project:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'delete_project',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { projectRoutes };
