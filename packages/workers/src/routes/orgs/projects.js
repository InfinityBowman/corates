/**
 * Org-scoped project routes for Hono
 * Routes: /api/orgs/:orgId/projects
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@/db/client.js';
import { projects, projectMembers, user } from '@/db/schema.js';
import { eq, and, count, desc } from 'drizzle-orm';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import {
  requireOrgMembership,
  requireProjectAccess,
  getOrgContext,
  getProjectContext,
} from '@/middleware/requireOrg.js';
import { requireEntitlement } from '@/middleware/requireEntitlement.js';
import { requireQuota } from '@/middleware/requireQuota.js';
import { requireOrgWriteAccess } from '@/middleware/requireOrgWriteAccess.js';
import {
  createDomainError,
  createValidationError,
  PROJECT_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { insertWithQuotaCheck } from '@/lib/quotaTransaction.js';
import { syncProjectToDO } from '@/lib/project-sync.js';
import { getProjectDocStub } from '@/lib/project-doc-id.js';
import { orgProjectMemberRoutes } from './members.js';
import { orgPdfRoutes } from './pdfs.js';
import { orgInvitationRoutes } from './invitations.js';
import { devRoutes } from './dev-routes.js';

const orgProjectRoutes = new OpenAPIHono({
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

// Response schemas
const ProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    orgId: z.string(),
    role: z.string().optional(),
    createdAt: z.union([z.string(), z.date()]),
    updatedAt: z.union([z.string(), z.date()]),
    createdBy: z.string().nullable(),
  })
  .openapi('Project');

const ProjectListSchema = z.array(ProjectSchema).openapi('ProjectList');

const CreateProjectRequestSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Project name is required')
      .max(255, 'Project name must be 255 characters or less')
      .openapi({ example: 'My Project' }),
    description: z
      .string()
      .max(2000, 'Description must be 2000 characters or less')
      .optional()
      .openapi({ example: 'Project description' }),
  })
  .openapi('CreateProjectRequest');

const UpdateProjectRequestSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Project name cannot be empty')
      .max(255, 'Project name must be 255 characters or less')
      .optional(),
    description: z.string().max(2000, 'Description must be 2000 characters or less').optional(),
  })
  .openapi('UpdateProjectRequest');

const ProjectErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.unknown()).optional(),
  })
  .openapi('ProjectError');

// Route definitions
const listProjectsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Projects'],
  summary: 'List projects',
  description: 'List all projects in the organization that the user has access to',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectListSchema } },
      description: 'List of projects',
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

const createProjectRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Projects'],
  summary: 'Create project',
  description: 'Create a new project in the organization',
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
    403: {
      content: { 'application/json': { schema: ProjectErrorSchema } },
      description: 'Not authorized or quota exceeded',
    },
    500: {
      content: { 'application/json': { schema: ProjectErrorSchema } },
      description: 'Database error',
    },
  },
});

const getProjectRoute = createRoute({
  method: 'get',
  path: '/{projectId}',
  tags: ['Projects'],
  summary: 'Get project',
  description: 'Get a single project by ID',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      projectId: z.string().min(1).openapi({ example: 'proj-123' }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectSchema } },
      description: 'Project details',
    },
    403: {
      content: { 'application/json': { schema: ProjectErrorSchema } },
      description: 'Not authorized',
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

const updateProjectRoute = createRoute({
  method: 'put',
  path: '/{projectId}',
  tags: ['Projects'],
  summary: 'Update project',
  description: 'Update project details',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      projectId: z.string().min(1).openapi({ example: 'proj-123' }),
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
      content: {
        'application/json': {
          schema: z
            .object({
              success: z.literal(true),
              projectId: z.string(),
            })
            .openapi('UpdateProjectResponse'),
        },
      },
      description: 'Project updated',
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
  path: '/{projectId}',
  tags: ['Projects'],
  summary: 'Delete project',
  description: 'Delete a project (owner only)',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      projectId: z.string().min(1).openapi({ example: 'proj-123' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z
            .object({
              success: z.literal(true),
              deleted: z.string(),
            })
            .openapi('DeleteProjectResponse'),
        },
      },
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

/**
 * Helper to run middleware manually and check for early response
 */
async function runMiddleware(middleware, c) {
  let nextCalled = false;

  const result = await middleware(c, async () => {
    nextCalled = true;
  });

  if (result instanceof Response) {
    return result;
  }

  if (!nextCalled && c.res) {
    return c.res;
  }

  return null;
}

/**
 * Helper to get current project count for org
 */
async function getProjectCount(c, _user) {
  const { orgId } = getOrgContext(c);
  const db = createDb(c.env.DB);
  const [result] = await db.select({ count: count() }).from(projects).where(eq(projects.orgId, orgId));
  return result?.count || 0;
}

// Apply auth middleware to all routes
orgProjectRoutes.use('*', requireAuth);

// Route handlers
orgProjectRoutes.openapi(listProjectsRoute, async c => {
  // Run membership middleware
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  const { user: authUser } = getAuth(c);
  const { orgId } = getOrgContext(c);
  const db = createDb(c.env.DB);

  try {
    const results = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        orgId: projects.orgId,
        role: projectMembers.role,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        createdBy: projects.createdBy,
      })
      .from(projects)
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(and(eq(projects.orgId, orgId), eq(projectMembers.userId, authUser.id)))
      .orderBy(desc(projects.updatedAt));

    return c.json(results);
  } catch (error) {
    console.error('Error listing org projects:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'list_org_projects',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

orgProjectRoutes.openapi(createProjectRoute, async c => {
  // Run membership middleware
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  // Run write access middleware
  const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
  if (writeAccessResponse) return writeAccessResponse;

  // Run entitlement middleware
  const entitlementResponse = await runMiddleware(requireEntitlement('project.create'), c);
  if (entitlementResponse) return entitlementResponse;

  // Run quota middleware
  const quotaResponse = await runMiddleware(requireQuota('projects.max', getProjectCount, 1), c);
  if (quotaResponse) return quotaResponse;

  const { user: authUser } = getAuth(c);
  const { orgId } = getOrgContext(c);
  const db = createDb(c.env.DB);
  const body = c.req.valid('json');
  const name = body.name.trim();
  const description = body.description?.trim() || null;

  const projectId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const now = new Date();

  try {
    const insertStatements = [
      db.insert(projects).values({
        id: projectId,
        name,
        description,
        orgId,
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
    ];

    const quotaResult = await insertWithQuotaCheck(db, {
      orgId,
      quotaKey: 'projects.max',
      countTable: projects,
      countColumn: projects.orgId,
      insertStatements,
    });

    if (!quotaResult.success) {
      return c.json(quotaResult.error, quotaResult.error.statusCode);
    }

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
          name,
          description,
          orgId,
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

    return c.json(
      {
        id: projectId,
        name,
        description,
        orgId,
        role: 'owner',
        createdAt: now,
        updatedAt: now,
      },
      201,
    );
  } catch (error) {
    console.error('Error creating project:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_TRANSACTION_FAILED, {
      operation: 'create_project',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

orgProjectRoutes.openapi(getProjectRoute, async c => {
  // Run membership middleware
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  // Run project access middleware
  const projectAccessResponse = await runMiddleware(requireProjectAccess(), c);
  if (projectAccessResponse) return projectAccessResponse;

  const { projectId, projectRole } = getProjectContext(c);
  const db = createDb(c.env.DB);

  try {
    const result = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        orgId: projects.orgId,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        createdBy: projects.createdBy,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    if (!result) {
      const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
      return c.json(error, error.statusCode);
    }

    return c.json({
      ...result,
      role: projectRole,
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_project',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

orgProjectRoutes.openapi(updateProjectRoute, async c => {
  // Run membership middleware
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  // Run write access middleware
  const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
  if (writeAccessResponse) return writeAccessResponse;

  // Run project access middleware (member role required)
  const projectAccessResponse = await runMiddleware(requireProjectAccess('member'), c);
  if (projectAccessResponse) return projectAccessResponse;

  const { projectId } = getProjectContext(c);
  const db = createDb(c.env.DB);
  const body = c.req.valid('json');
  const name = body.name?.trim();
  const description = body.description?.trim();

  try {
    const now = new Date();

    const updateData = { updatedAt: now };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;

    await db.update(projects).set(updateData).where(eq(projects.id, projectId));

    const metaUpdate = { updatedAt: now.getTime() };
    if (name !== undefined) metaUpdate.name = name;
    if (description !== undefined) metaUpdate.description = description || null;

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

orgProjectRoutes.openapi(deleteProjectRoute, async c => {
  // Run membership middleware
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  // Run write access middleware
  const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
  if (writeAccessResponse) return writeAccessResponse;

  // Run project access middleware (owner role required)
  const projectAccessResponse = await runMiddleware(requireProjectAccess('owner'), c);
  if (projectAccessResponse) return projectAccessResponse;

  const { user: authUser } = getAuth(c);
  const { projectId } = getProjectContext(c);
  const db = createDb(c.env.DB);

  try {
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

    // Clean up all PDFs from R2 storage
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

// Mount org-scoped project member routes
orgProjectRoutes.route('/:projectId/members', orgProjectMemberRoutes);

// Mount org-scoped PDF routes
orgProjectRoutes.route('/:projectId/studies/:studyId/pdfs', orgPdfRoutes);

// Mount org-scoped invitation routes
orgProjectRoutes.route('/:projectId/invitations', orgInvitationRoutes);

// Dev routes
orgProjectRoutes.route('/:projectId/dev', devRoutes);

export { orgProjectRoutes };
