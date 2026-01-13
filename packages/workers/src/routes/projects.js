/**
 * Project routes for Hono
 * Handles project CRUD operations
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@/db/client.js';
import { projects, projectMembers, user } from '@/db/schema.js';
import { eq, and, count } from 'drizzle-orm';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { requireEntitlement } from '@/middleware/requireEntitlement.js';
import { requireQuota } from '@/middleware/requireQuota.js';
import { EDIT_ROLES } from '@/config/constants.js';
import {
  createDomainError,
  createValidationError,
  PROJECT_ERRORS,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { syncProjectToDO } from '@/lib/project-sync.js';
import { getProjectDocStub } from '@/lib/project-doc-id.js';

const projectRoutes = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const field = firstIssue?.path?.[0] || 'input';
      const fieldName = String(field).charAt(0).toUpperCase() + String(field).slice(1);

      let message = firstIssue?.message || 'Validation failed';
      const isMissing =
        firstIssue?.received === 'undefined' ||
        message.includes('received undefined') ||
        message.includes('Required');

      if (isMissing) {
        message = `${fieldName} is required`;
      }

      const error = createValidationError(
        String(field),
        VALIDATION_ERRORS.FIELD_REQUIRED.code,
        null,
      );
      error.message = message;
      return c.json(error, 400);
    }
  },
});

// Apply auth middleware to all routes
projectRoutes.use('*', requireAuth);

// Request schemas
const CreateProjectRequestSchema = z
  .object({
    name: z.string().min(1).max(100).openapi({ example: 'My Project' }),
    description: z.string().max(500).optional().openapi({ example: 'Project description' }),
  })
  .openapi('CreateProjectRequest');

const UpdateProjectRequestSchema = z
  .object({
    name: z.string().min(1).max(100).optional().openapi({ example: 'Updated Name' }),
    description: z.string().max(500).optional().openapi({ example: 'Updated description' }),
  })
  .openapi('UpdateProjectRequest');

// Response schemas
const ProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    role: z.string(),
    createdAt: z.string().or(z.date()),
    updatedAt: z.string().or(z.date()),
    createdBy: z.string().optional(),
  })
  .openapi('Project');

const ProjectSuccessSchema = z
  .object({
    success: z.literal(true),
    projectId: z.string(),
  })
  .openapi('ProjectSuccess');

const DeleteProjectSuccessSchema = z
  .object({
    success: z.literal(true),
    deleted: z.string(),
  })
  .openapi('DeleteProjectSuccess');

const ProjectErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.unknown()).optional(),
  })
  .openapi('ProjectError');

// Route definitions
const getProjectRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['Projects'],
  summary: 'Get project',
  description: 'Get a single project by ID',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ example: 'proj-123' }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectSchema } },
      description: 'Project details',
    },
    404: {
      content: { 'application/json': { schema: ProjectErrorSchema } },
      description: 'Project not found',
    },
    500: {
      content: { 'application/json': { schema: ProjectErrorSchema } },
      description: 'Database error',
    },
  },
});

const createProjectRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Projects'],
  summary: 'Create project',
  description: 'Create a new project',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateProjectRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: ProjectSchema } },
      description: 'Project created',
    },
    400: {
      content: { 'application/json': { schema: ProjectErrorSchema } },
      description: 'Validation error',
    },
    403: {
      content: { 'application/json': { schema: ProjectErrorSchema } },
      description: 'Quota exceeded or not entitled',
    },
    500: {
      content: { 'application/json': { schema: ProjectErrorSchema } },
      description: 'Database error',
    },
  },
});

const updateProjectRoute = createRoute({
  method: 'put',
  path: '/:id',
  tags: ['Projects'],
  summary: 'Update project',
  description: 'Update project details',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ example: 'proj-123' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateProjectRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectSuccessSchema } },
      description: 'Project updated',
    },
    400: {
      content: { 'application/json': { schema: ProjectErrorSchema } },
      description: 'Validation error',
    },
    403: {
      content: { 'application/json': { schema: ProjectErrorSchema } },
      description: 'Not authorized',
    },
    500: {
      content: { 'application/json': { schema: ProjectErrorSchema } },
      description: 'Database error',
    },
  },
});

const deleteProjectRoute = createRoute({
  method: 'delete',
  path: '/:id',
  tags: ['Projects'],
  summary: 'Delete project',
  description: 'Delete a project (owner only)',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ example: 'proj-123' }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: DeleteProjectSuccessSchema } },
      description: 'Project deleted',
    },
    403: {
      content: { 'application/json': { schema: ProjectErrorSchema } },
      description: 'Not authorized',
    },
    500: {
      content: { 'application/json': { schema: ProjectErrorSchema } },
      description: 'Database error',
    },
  },
});

// Helper to get current project count for user
async function getProjectCount(c, authUser) {
  const db = createDb(c.env.DB);
  const [result] = await db
    .select({ count: count() })
    .from(projects)
    .where(eq(projects.createdBy, authUser.id));
  return result?.count || 0;
}

// Route handlers
projectRoutes.openapi(getProjectRoute, async c => {
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

// Create project with middleware chain
projectRoutes.use('/', requireEntitlement('project.create'));
projectRoutes.use('/', requireQuota('projects.max', getProjectCount, 1));

projectRoutes.openapi(createProjectRoute, async c => {
  const { user: authUser } = getAuth(c);
  const db = createDb(c.env.DB);
  const { name, description } = c.req.valid('json');

  const projectId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const now = new Date();

  try {
    await db.batch([
      db.insert(projects).values({
        id: projectId,
        name: name.trim(),
        description: description?.trim() || null,
        createdBy: authUser.id,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(projectMembers).values({
        id: memberId,
        projectId,
        userId: authUser.id,
        role: 'owner',
        joinedAt: now,
      }),
    ]);

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

    try {
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
    } catch (err) {
      console.error('Failed to sync project to DO:', err);
    }

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
});

projectRoutes.openapi(updateProjectRoute, async c => {
  const { user: authUser } = getAuth(c);
  const projectId = c.req.param('id');
  const db = createDb(c.env.DB);
  const { name, description } = c.req.valid('json');

  try {
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

    const updateData = { updatedAt: now };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    await db.update(projects).set(updateData).where(eq(projects.id, projectId));

    const metaUpdate = { updatedAt: now.getTime() };
    if (name !== undefined) metaUpdate.name = name;
    if (description !== undefined) metaUpdate.description = description;

    try {
      await syncProjectToDO(c.env, projectId, metaUpdate, null);
    } catch (err) {
      console.error('Failed to sync project update to DO:', err);
    }

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

projectRoutes.openapi(deleteProjectRoute, async c => {
  const { user: authUser } = getAuth(c);
  const projectId = c.req.param('id');
  const db = createDb(c.env.DB);

  try {
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

    try {
      const projectDoc = getProjectDocStub(c.env, projectId);
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

    try {
      const prefix = `projects/${projectId}/`;
      let cursor = undefined;
      let deletedCount = 0;

      do {
        const listed = await c.env.PDF_BUCKET.list({ prefix, cursor });

        if (listed.objects.length > 0) {
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
    }

    await db.delete(projects).where(eq(projects.id, projectId));

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
