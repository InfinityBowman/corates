/**
 * Admin project management routes
 * Handles project listing, search, and details
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

import { createDb } from '@/db/client.js';
import {
  projects,
  projectMembers,
  projectInvitations,
  mediaFiles,
  organization,
  user,
} from '@/db/schema.js';
import { eq, count, desc, like, sql, and } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS, PROJECT_ERRORS } from '@corates/shared';
import { validationHook } from '@/lib/honoValidationHook.js';
import type { Env } from '../../types';
import { ErrorResponseSchema } from '@/schemas/common.js';

const base = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

// Response schemas
const PaginationSchema = z
  .object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  })
  .openapi('AdminProjectPagination');

const ProjectWithStatsSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    orgId: z.string(),
    orgName: z.string().nullable(),
    orgSlug: z.string().nullable(),
    createdBy: z.string(),
    creatorName: z.string().nullable(),
    creatorGivenName: z.string().nullable(),
    creatorEmail: z.string().nullable(),
    createdAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    updatedAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    memberCount: z.number(),
    fileCount: z.number(),
  })
  .openapi('AdminProjectWithStats');

const ProjectListResponseSchema = z
  .object({
    projects: z.array(ProjectWithStatsSchema),
    pagination: PaginationSchema,
  })
  .openapi('AdminProjectListResponse');

const ProjectMemberSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    userName: z.string().nullable(),
    userGivenName: z.string().nullable(),
    userEmail: z.string().nullable(),
    userAvatar: z.string().nullable(),
    role: z.string().nullable(),
    joinedAt: z.union([z.string(), z.date(), z.number()]).nullable(),
  })
  .openapi('AdminProjectMember');

const ProjectFileSchema = z
  .object({
    id: z.string(),
    filename: z.string(),
    originalName: z.string().nullable(),
    fileType: z.string().nullable(),
    fileSize: z.number().nullable(),
    uploadedBy: z.string().nullable(),
    uploaderName: z.string().nullable(),
    uploaderGivenName: z.string().nullable(),
    studyId: z.string().nullable(),
    createdAt: z.union([z.string(), z.date(), z.number()]).nullable(),
  })
  .openapi('AdminProjectFile');

const ProjectInvitationSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    role: z.string().nullable(),
    invitedBy: z.string(),
    inviterName: z.string().nullable(),
    inviterGivenName: z.string().nullable(),
    expiresAt: z.union([z.string(), z.date(), z.number()]),
    acceptedAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    createdAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    grantOrgMembership: z.union([z.boolean(), z.number()]),
  })
  .openapi('AdminProjectInvitation');

const ProjectStatsSchema = z
  .object({
    memberCount: z.number(),
    fileCount: z.number(),
    totalStorageBytes: z.number(),
  })
  .openapi('AdminProjectStats');

const ProjectDetailsResponseSchema = z
  .object({
    project: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      orgId: z.string(),
      orgName: z.string().nullable(),
      orgSlug: z.string().nullable(),
      createdBy: z.string(),
      creatorName: z.string().nullable(),
      creatorGivenName: z.string().nullable(),
      creatorEmail: z.string().nullable(),
      createdAt: z.union([z.string(), z.date(), z.number()]).nullable(),
      updatedAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    }),
    members: z.array(ProjectMemberSchema),
    files: z.array(ProjectFileSchema),
    invitations: z.array(ProjectInvitationSchema),
    stats: ProjectStatsSchema,
  })
  .openapi('AdminProjectDetailsResponse');

const SuccessResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
  })
  .openapi('AdminProjectSuccessResponse');

// Mirrors `ProjectDocStorageStats` from ProjectDoc.ts. We define the
// schema here rather than importing the type so this route file owns its
// own contract — the underlying RPC method can return additional fields
// without breaking the API surface, and Zod validation catches any drift.
const ProjectDocStatsResponseSchema = z
  .object({
    rows: z.object({
      total: z.number(),
      snapshot: z.number(),
      update: z.number(),
      snapshotBytes: z.number(),
      updateBytes: z.number(),
      totalBytes: z.number(),
    }),
    encodedSnapshotBytes: z.number(),
    memoryUsagePercent: z.number(),
    content: z.object({
      members: z.number(),
      studies: z.number(),
      checklists: z.number(),
      pdfs: z.number(),
    }),
    timestamps: z.object({
      oldestRowAt: z.number().nullable(),
      newestRowAt: z.number().nullable(),
    }),
  })
  .openapi('AdminProjectDocStatsResponse');

// Route definitions
const listProjectsRoute = createRoute({
  method: 'get',
  path: '/projects',
  tags: ['Admin - Projects'],
  summary: 'List all projects',
  description: 'List all projects with pagination and search. Admin only.',
  request: {
    query: z.object({
      page: z.string().optional().openapi({ description: 'Page number', example: '1' }),
      limit: z
        .string()
        .optional()
        .openapi({ description: 'Results per page (max 100)', example: '20' }),
      search: z
        .string()
        .optional()
        .openapi({ description: 'Search by name', example: 'my project' }),
      orgId: z
        .string()
        .optional()
        .openapi({ description: 'Filter by organization ID', example: 'org-123' }),
    }),
  },
  responses: {
    200: {
      description: 'List of projects with stats',
      content: {
        'application/json': {
          schema: ProjectListResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - not logged in',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - not an admin',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const getProjectDetailsRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}',
  tags: ['Admin - Projects'],
  summary: 'Get project details',
  description: 'Get full project details including members, files, and invitations. Admin only.',
  request: {
    params: z.object({
      projectId: z.string().openapi({ description: 'Project ID', example: 'proj-123' }),
    }),
  },
  responses: {
    200: {
      description: 'Project details',
      content: {
        'application/json': {
          schema: ProjectDetailsResponseSchema,
        },
      },
    },
    404: {
      description: 'Project not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const getProjectDocStatsRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/doc-stats',
  tags: ['Admin - Projects'],
  summary: 'Get project Y.Doc storage stats',
  description:
    'Returns DO SQLite row counts, byte totals, encoded snapshot size, and logical content counts for a single project. Used by the admin dashboard to surface storage growth and memory pressure. Admin only.',
  request: {
    params: z.object({
      projectId: z.string().openapi({ description: 'Project ID', example: 'proj-123' }),
    }),
  },
  responses: {
    200: {
      description: 'Project doc storage stats',
      content: {
        'application/json': {
          schema: ProjectDocStatsResponseSchema,
        },
      },
    },
    404: {
      description: 'Project not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const removeProjectMemberRoute = createRoute({
  method: 'delete',
  path: '/projects/{projectId}/members/{memberId}',
  tags: ['Admin - Projects'],
  summary: 'Remove project member',
  description: 'Remove a member from a project. Admin only.',
  request: {
    params: z.object({
      projectId: z.string().openapi({ description: 'Project ID', example: 'proj-123' }),
      memberId: z.string().openapi({ description: 'Member ID', example: 'member-123' }),
    }),
  },
  responses: {
    200: {
      description: 'Member removed',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
    },
    404: {
      description: 'Member not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const deleteProjectRoute = createRoute({
  method: 'delete',
  path: '/projects/{projectId}',
  tags: ['Admin - Projects'],
  summary: 'Delete project',
  description: 'Delete a project and all associated data. Admin only.',
  request: {
    params: z.object({
      projectId: z.string().openapi({ description: 'Project ID', example: 'proj-123' }),
    }),
  },
  responses: {
    200: {
      description: 'Project deleted',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
    },
    404: {
      description: 'Project not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

interface ProjectStats {
  memberCount: number;
  fileCount: number;
}

/**
 * GET /api/admin/projects
 * List all projects with pagination and search
 */
const projectRoutes = base
  .openapi(listProjectsRoute, async c => {
    const db = createDb(c.env.DB);

    try {
      const query = c.req.valid('query');
      const page = parseInt(query.page || '1', 10);
      const limit = Math.min(parseInt(query.limit || '20', 10), 100);
      const search = query.search;
      const orgId = query.orgId;

      const offset = (page - 1) * limit;

      // Build where conditions
      const conditions = [];
      if (search) {
        const searchLower = search.toLowerCase();
        conditions.push(like(sql`LOWER(${projects.name})`, `%${searchLower}%`));
      }
      if (orgId) {
        conditions.push(eq(projects.orgId, orgId));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count for pagination
      const totalCountQuery =
        whereClause ?
          db.select({ count: count() }).from(projects).where(whereClause)
        : db.select({ count: count() }).from(projects);

      const [totalResult] = await totalCountQuery.all();
      const total = totalResult?.count || 0;

      // Get paginated results with org and creator info
      const baseQuery = db
        .select({
          id: projects.id,
          name: projects.name,
          description: projects.description,
          orgId: projects.orgId,
          orgName: organization.name,
          orgSlug: organization.slug,
          createdBy: projects.createdBy,
          creatorName: user.name,
          creatorGivenName: user.givenName,
          creatorEmail: user.email,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
        })
        .from(projects)
        .leftJoin(organization, eq(projects.orgId, organization.id))
        .leftJoin(user, eq(projects.createdBy, user.id));

      const projectList = await (whereClause ? baseQuery.where(whereClause) : baseQuery)
        .orderBy(desc(projects.createdAt))
        .limit(limit)
        .offset(offset)
        .all();

      // Get member counts and file counts for all projects
      const projectIds = projectList.map(p => p.id);
      const statsMap: Record<string, ProjectStats> = {};

      if (projectIds.length > 0) {
        // Get member counts
        const memberCounts = await db
          .select({
            projectId: projectMembers.projectId,
            count: count(),
          })
          .from(projectMembers)
          .where(
            sql`${projectMembers.projectId} IN (${sql.join(
              projectIds.map(id => sql`${id}`),
              sql`, `,
            )})`,
          )
          .groupBy(projectMembers.projectId)
          .all();

        // Get file counts
        const fileCounts = await db
          .select({
            projectId: mediaFiles.projectId,
            count: count(),
          })
          .from(mediaFiles)
          .where(
            sql`${mediaFiles.projectId} IN (${sql.join(
              projectIds.map(id => sql`${id}`),
              sql`, `,
            )})`,
          )
          .groupBy(mediaFiles.projectId)
          .all();

        // Build stats map
        for (const mc of memberCounts) {
          statsMap[mc.projectId] = { memberCount: mc.count, fileCount: 0 };
        }
        for (const fc of fileCounts) {
          if (!statsMap[fc.projectId]) {
            statsMap[fc.projectId] = { memberCount: 0, fileCount: fc.count };
          } else {
            statsMap[fc.projectId].fileCount = fc.count;
          }
        }
      }

      // Merge stats into project list
      const projectsWithStats = projectList.map(p => ({
        ...p,
        memberCount: statsMap[p.id]?.memberCount || 0,
        fileCount: statsMap[p.id]?.fileCount || 0,
      }));

      return c.json(
        {
          projects: projectsWithStats,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
        200,
      );
    } catch (err) {
      const error = err as Error;
      console.error('Error fetching admin projects:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        message: error.message,
      });
      return c.json(dbError, 500);
    }
  })

  /**
   * GET /api/admin/projects/:projectId
   * Get full project details including members, files, and invitations
   */
  .openapi(getProjectDetailsRoute, async c => {
    const { projectId } = c.req.valid('param');
    const db = createDb(c.env.DB);

    try {
      // Get project with org and creator info
      const [project] = await db
        .select({
          id: projects.id,
          name: projects.name,
          description: projects.description,
          orgId: projects.orgId,
          orgName: organization.name,
          orgSlug: organization.slug,
          createdBy: projects.createdBy,
          creatorName: user.name,
          creatorGivenName: user.givenName,
          creatorEmail: user.email,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
        })
        .from(projects)
        .leftJoin(organization, eq(projects.orgId, organization.id))
        .leftJoin(user, eq(projects.createdBy, user.id))
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) {
        const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
        return c.json(error, 404);
      }

      // Get project members with user details
      const members = await db
        .select({
          id: projectMembers.id,
          userId: projectMembers.userId,
          userName: user.name,
          userGivenName: user.givenName,
          userEmail: user.email,
          userAvatar: user.image,
          role: projectMembers.role,
          joinedAt: projectMembers.joinedAt,
        })
        .from(projectMembers)
        .leftJoin(user, eq(projectMembers.userId, user.id))
        .where(eq(projectMembers.projectId, projectId))
        .orderBy(desc(projectMembers.joinedAt))
        .all();

      // Get media files
      const files = await db
        .select({
          id: mediaFiles.id,
          filename: mediaFiles.filename,
          originalName: mediaFiles.originalName,
          fileType: mediaFiles.fileType,
          fileSize: mediaFiles.fileSize,
          uploadedBy: mediaFiles.uploadedBy,
          uploaderName: user.name,
          uploaderGivenName: user.givenName,
          studyId: mediaFiles.studyId,
          createdAt: mediaFiles.createdAt,
        })
        .from(mediaFiles)
        .leftJoin(user, eq(mediaFiles.uploadedBy, user.id))
        .where(eq(mediaFiles.projectId, projectId))
        .orderBy(desc(mediaFiles.createdAt))
        .all();

      // Get invitations (pending and recent)
      const invitations = await db
        .select({
          id: projectInvitations.id,
          email: projectInvitations.email,
          role: projectInvitations.role,
          invitedBy: projectInvitations.invitedBy,
          inviterName: user.name,
          inviterGivenName: user.givenName,
          expiresAt: projectInvitations.expiresAt,
          acceptedAt: projectInvitations.acceptedAt,
          createdAt: projectInvitations.createdAt,
          grantOrgMembership: projectInvitations.grantOrgMembership,
        })
        .from(projectInvitations)
        .leftJoin(user, eq(projectInvitations.invitedBy, user.id))
        .where(eq(projectInvitations.projectId, projectId))
        .orderBy(desc(projectInvitations.createdAt))
        .limit(50)
        .all();

      // Calculate storage usage
      const totalStorageBytes = files.reduce((sum, f) => sum + (f.fileSize || 0), 0);

      return c.json(
        {
          project,
          members,
          files,
          invitations,
          stats: {
            memberCount: members.length,
            fileCount: files.length,
            totalStorageBytes,
          },
        },
        200,
      );
    } catch (err) {
      const error = err as Error;
      console.error('Error fetching admin project detail:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        message: error.message,
      });
      return c.json(dbError, 500);
    }
  })

  /**
   * GET /api/admin/projects/:projectId/doc-stats
   * Return DO storage stats (rows, byte totals, encoded snapshot size,
   * memory usage %, and logical content counts) for a single project.
   *
   * This routes to the ProjectDoc DO and reads its in-memory state, so the
   * DO is woken if it was hibernating. The 404 path checks D1 first to
   * avoid waking a DO for a project that doesn't exist.
   */
  .openapi(getProjectDocStatsRoute, async c => {
    const { projectId } = c.req.valid('param');
    const db = createDb(c.env.DB);

    try {
      // Verify the project exists in D1 before touching the DO. Without
      // this we'd wake a stub for any random ID and the DO would happily
      // initialize an empty doc.
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) {
        const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
        return c.json(error, 404);
      }

      const { getProjectDocStub } = await import('@/lib/project-doc-id.js');
      const projectDoc = getProjectDocStub(c.env, projectId);
      const stats = await projectDoc.getStorageStats();
      return c.json(stats, 200);
    } catch (err) {
      const error = err as Error;
      console.error('Error fetching project doc stats:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        message: error.message,
      });
      return c.json(dbError, 500);
    }
  })

  /**
   * DELETE /api/admin/projects/:projectId/members/:memberId
   * Remove a member from a project
   */
  .openapi(removeProjectMemberRoute, async c => {
    const { projectId, memberId } = c.req.valid('param');
    const db = createDb(c.env.DB);

    try {
      // Verify the member belongs to the project
      const [existingMember] = await db
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(and(eq(projectMembers.id, memberId), eq(projectMembers.projectId, projectId)))
        .limit(1);

      if (!existingMember) {
        const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { memberId });
        return c.json(error, 404);
      }

      await db.delete(projectMembers).where(eq(projectMembers.id, memberId));

      return c.json({ success: true, message: 'Member removed from project' }, 200);
    } catch (err) {
      const error = err as Error;
      console.error('Error removing project member:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        message: error.message,
      });
      return c.json(dbError, 500);
    }
  })

  /**
   * DELETE /api/admin/projects/:projectId
   * Delete a project and all associated data
   */
  .openapi(deleteProjectRoute, async c => {
    const { projectId } = c.req.valid('param');
    const db = createDb(c.env.DB);

    try {
      // Verify project exists
      const [existingProject] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!existingProject) {
        const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
        return c.json(error, 404);
      }

      // Delete project (cascade will handle members, invitations, files)
      await db.delete(projects).where(eq(projects.id, projectId));

      return c.json({ success: true, message: 'Project deleted' }, 200);
    } catch (err) {
      const error = err as Error;
      console.error('Error deleting project:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        message: error.message,
      });
      return c.json(dbError, 500);
    }
  });

export { projectRoutes };
export type ProjectRoutes = typeof projectRoutes;
