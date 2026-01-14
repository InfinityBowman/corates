/**
 * Org-scoped project routes for Hono
 * Routes: /api/orgs/:orgId/projects
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@/db/client.js';
import { projects, projectMembers } from '@/db/schema.js';
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
  isDomainError,
  PROJECT_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { createProject, updateProject, deleteProject } from '@/commands/projects/index.js';
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
  const [result] = await db
    .select({ count: count() })
    .from(projects)
    .where(eq(projects.orgId, orgId));
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
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
  if (writeAccessResponse) return writeAccessResponse;

  const entitlementResponse = await runMiddleware(requireEntitlement('project.create'), c);
  if (entitlementResponse) return entitlementResponse;

  const quotaResponse = await runMiddleware(requireQuota('projects.max', getProjectCount, 1), c);
  if (quotaResponse) return quotaResponse;

  const { user: authUser } = getAuth(c);
  const { orgId } = getOrgContext(c);
  const body = c.req.valid('json');

  try {
    const { project } = await createProject(c.env, authUser, {
      orgId,
      name: body.name,
      description: body.description,
    });

    return c.json(project, 201);
  } catch (error) {
    if (isDomainError(error)) {
      return c.json(error, error.statusCode);
    }
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
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
  if (writeAccessResponse) return writeAccessResponse;

  const projectAccessResponse = await runMiddleware(requireProjectAccess('member'), c);
  if (projectAccessResponse) return projectAccessResponse;

  const { user: authUser } = getAuth(c);
  const { projectId } = getProjectContext(c);
  const body = c.req.valid('json');

  try {
    const result = await updateProject(c.env, authUser, {
      projectId,
      name: body.name,
      description: body.description,
    });

    return c.json({ success: true, projectId: result.projectId });
  } catch (error) {
    if (isDomainError(error)) {
      return c.json(error, error.statusCode);
    }
    console.error('Error updating project:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_project',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

orgProjectRoutes.openapi(deleteProjectRoute, async c => {
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
  if (writeAccessResponse) return writeAccessResponse;

  const projectAccessResponse = await runMiddleware(requireProjectAccess('owner'), c);
  if (projectAccessResponse) return projectAccessResponse;

  const { user: authUser } = getAuth(c);
  const { projectId } = getProjectContext(c);

  try {
    const result = await deleteProject(c.env, authUser, { projectId });

    return c.json({ success: true, deleted: result.deleted });
  } catch (error) {
    if (isDomainError(error)) {
      return c.json(error, error.statusCode);
    }
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
