/**
 * Org-scoped project routes for Hono
 * Routes: /api/orgs/:orgId/projects
 */

import { Hono } from 'hono';
import { createDb } from '../../db/client.js';
import { projects, projectMembers, user } from '../../db/schema.js';
import { eq, and, count, desc } from 'drizzle-orm';
import { requireAuth, getAuth } from '../../middleware/auth.js';
import { requireOrgMembership, requireProjectAccess, getOrgContext, getProjectContext } from '../../middleware/requireOrg.js';
import { requireEntitlement } from '../../middleware/requireEntitlement.js';
import { requireQuota } from '../../middleware/requireQuota.js';
import { projectSchemas, validateRequest } from '../../config/validation.js';
import { createDomainError, PROJECT_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { syncProjectToDO } from '../../lib/project-sync.js';
import { orgProjectMemberRoutes } from './members.js';
import { orgPdfRoutes } from './pdfs.js';
import { orgInvitationRoutes } from './invitations.js';

const orgProjectRoutes = new Hono();

// Apply auth and org membership middleware to all routes
orgProjectRoutes.use('*', requireAuth);

/**
 * GET /api/orgs/:orgId/projects
 * List all projects in the organization that the user has access to
 */
orgProjectRoutes.get('/', requireOrgMembership(), async c => {
  const { user: authUser } = getAuth(c);
  const { orgId } = getOrgContext(c);
  const db = createDb(c.env.DB);

  try {
    // Get projects in this org that the user is a member of
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

/**
 * Helper to get current project count for user in this org
 */
async function getProjectCount(c, user) {
  const { orgId } = getOrgContext(c);
  const db = createDb(c.env.DB);
  const [result] = await db
    .select({ count: count() })
    .from(projects)
    .where(and(eq(projects.orgId, orgId), eq(projects.createdBy, user.id)));
  return result?.count || 0;
}

/**
 * POST /api/orgs/:orgId/projects
 * Create a new project in the organization
 */
orgProjectRoutes.post(
  '/',
  requireOrgMembership(),
  requireEntitlement('project.create'),
  requireQuota('projects.max', getProjectCount, 1),
  validateRequest(projectSchemas.create),
  async c => {
    const { user: authUser } = getAuth(c);
    const { orgId } = getOrgContext(c);
    const db = createDb(c.env.DB);
    const { name, description } = c.get('validatedBody');

    const projectId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const now = new Date();

    try {
      // Create project with orgId and add creator as owner
      await db.batch([
        db.insert(projects).values({
          id: projectId,
          name: name.trim(),
          description: description?.trim() || null,
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
      ]);

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
      try {
        await syncProjectToDO(
          c.env,
          projectId,
          {
            name: name.trim(),
            description: description?.trim() || null,
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
          name: name.trim(),
          description: description?.trim() || null,
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
  },
);

/**
 * GET /api/orgs/:orgId/projects/:projectId
 * Get a single project by ID
 */
orgProjectRoutes.get('/:projectId', requireOrgMembership(), requireProjectAccess(), async c => {
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

/**
 * PUT /api/orgs/:orgId/projects/:projectId
 * Update project details
 */
orgProjectRoutes.put(
  '/:projectId',
  requireOrgMembership(),
  requireProjectAccess('collaborator'),
  validateRequest(projectSchemas.update),
  async c => {
    const { projectId } = getProjectContext(c);
    const db = createDb(c.env.DB);
    const { name, description } = c.get('validatedBody');

    try {
      const now = new Date();

      const updateData = { updatedAt: now };
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      await db.update(projects).set(updateData).where(eq(projects.id, projectId));

      // Sync updated meta to DO
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
  },
);

/**
 * DELETE /api/orgs/:orgId/projects/:projectId
 * Delete a project (owner only)
 */
orgProjectRoutes.delete(
  '/:projectId',
  requireOrgMembership(),
  requireProjectAccess('owner'),
  async c => {
    const { user: authUser } = getAuth(c);
    const { projectId } = getProjectContext(c);
    const db = createDb(c.env.DB);

    try {
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
  },
);

// Mount org-scoped project member routes
orgProjectRoutes.route('/:projectId/members', orgProjectMemberRoutes);

// Mount org-scoped PDF routes
orgProjectRoutes.route('/:projectId/studies/:studyId/pdfs', orgPdfRoutes);

// Mount org-scoped invitation routes
orgProjectRoutes.route('/:projectId/invitations', orgInvitationRoutes);

export { orgProjectRoutes };
