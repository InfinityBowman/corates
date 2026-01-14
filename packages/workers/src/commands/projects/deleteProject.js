/**
 * Delete a project and clean up associated resources
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {Object} actor - User performing the deletion
 * @param {Object} params - Delete parameters
 * @param {string} params.projectId - Project ID to delete
 * @returns {Promise<{ deleted: string, notifiedCount: number }>}
 * @throws {DomainError} DB_ERROR on database error
 */

import { createDb } from '@/db/client.js';
import { projects, projectMembers } from '@/db/schema.js';
import { eq } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { disconnectAllFromProject, cleanupProjectStorage } from '@/commands/lib/doSync.js';
import { notifyUsers, NotificationTypes } from '@/commands/lib/notifications.js';

export async function deleteProject(env, actor, { projectId }) {
  const db = createDb(env.DB);

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
    await disconnectAllFromProject(env, projectId);
  } catch (err) {
    console.error('Failed to disconnect users from DO:', err);
  }

  // Clean up all PDFs from R2 storage
  try {
    await cleanupProjectStorage(env, projectId);
  } catch (err) {
    console.error('Failed to clean up R2 files for project:', projectId, err);
  }

  try {
    await db.delete(projects).where(eq(projects.id, projectId));
  } catch (err) {
    throw createDomainError(
      SYSTEM_ERRORS.DB_ERROR,
      { operation: 'delete_project', projectId, originalError: err.message },
      'Failed to delete project',
    );
  }

  // Send notifications to all members (except the one who deleted)
  const userIds = members.map(m => m.userId);
  const notifiedCount = await notifyUsers(
    env,
    userIds,
    {
      type: NotificationTypes.PROJECT_DELETED,
      projectId,
      projectName: project?.name || 'Unknown Project',
      deletedBy: actor.name || actor.email,
    },
    actor.id,
  );

  return { deleted: projectId, notifiedCount };
}
