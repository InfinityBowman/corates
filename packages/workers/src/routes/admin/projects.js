/**
 * Admin project management routes
 * Handles project listing, search, and details
 */

import { Hono } from 'hono';
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

const projectRoutes = new Hono();

/**
 * GET /api/admin/projects
 * List all projects with pagination and search
 * Query params:
 *   - page: page number (default 1)
 *   - limit: results per page (default 20, max 100)
 *   - search: search by name
 *   - orgId: filter by organization
 */
projectRoutes.get('/projects', async c => {
  const db = createDb(c.env.DB);

  try {
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
    const search = c.req.query('search');
    const orgId = c.req.query('orgId');

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
    const projectList = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        orgId: projects.orgId,
        orgName: organization.name,
        orgSlug: organization.slug,
        createdBy: projects.createdBy,
        creatorName: user.name,
        creatorDisplayName: user.displayName,
        creatorEmail: user.email,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .leftJoin(organization, eq(projects.orgId, organization.id))
      .leftJoin(user, eq(projects.createdBy, user.id))
      .where(whereClause)
      .orderBy(desc(projects.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    // Get member counts and file counts for all projects
    const projectIds = projectList.map(p => p.id);
    const statsMap = {};

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

    return c.json({
      projects: projectsWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching admin projects:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      message: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /api/admin/projects/:projectId
 * Get full project details including members, files, and invitations
 */
projectRoutes.get('/projects/:projectId', async c => {
  const projectId = c.req.param('projectId');
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
        creatorDisplayName: user.displayName,
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
      return c.json(error, error.statusCode);
    }

    // Get project members with user details
    const members = await db
      .select({
        id: projectMembers.id,
        userId: projectMembers.userId,
        userName: user.name,
        userDisplayName: user.displayName,
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
        uploaderDisplayName: user.displayName,
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
        inviterDisplayName: user.displayName,
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

    return c.json({
      project,
      members,
      files,
      invitations,
      stats: {
        memberCount: members.length,
        fileCount: files.length,
        totalStorageBytes,
      },
    });
  } catch (error) {
    console.error('Error fetching admin project detail:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      message: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * DELETE /api/admin/projects/:projectId/members/:memberId
 * Remove a member from a project
 */
projectRoutes.delete('/projects/:projectId/members/:memberId', async c => {
  const projectId = c.req.param('projectId');
  const memberId = c.req.param('memberId');
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
      return c.json(error, error.statusCode);
    }

    await db.delete(projectMembers).where(eq(projectMembers.id, memberId));

    return c.json({ success: true, message: 'Member removed from project' });
  } catch (error) {
    console.error('Error removing project member:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      message: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * DELETE /api/admin/projects/:projectId
 * Delete a project and all associated data
 */
projectRoutes.delete('/projects/:projectId', async c => {
  const projectId = c.req.param('projectId');
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
      return c.json(error, error.statusCode);
    }

    // Delete project (cascade will handle members, invitations, files)
    await db.delete(projects).where(eq(projects.id, projectId));

    return c.json({ success: true, message: 'Project deleted' });
  } catch (error) {
    console.error('Error deleting project:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      message: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { projectRoutes };
