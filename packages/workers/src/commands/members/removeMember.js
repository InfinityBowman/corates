/**
 * Remove a member from a project
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {Object} actor - User performing the action
 * @param {Object} params - Remove parameters
 * @param {string} params.orgId - Organization ID
 * @param {string} params.projectId - Project ID
 * @param {string} params.userId - User ID to remove
 * @param {boolean} params.isSelfRemoval - Whether the user is removing themselves
 * @returns {Promise<{ removed: string }>}
 * @throws {DomainError} NOT_FOUND if member not found
 * @throws {DomainError} LAST_OWNER if removing the last owner
 */

import { createDb } from '@/db/client.js';
import { projectMembers, projects } from '@/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { createDomainError, PROJECT_ERRORS } from '@corates/shared';
import { syncMemberToDO } from '@/commands/lib/doSync.js';
import { notifyUser, NotificationTypes } from '@/commands/lib/notifications.js';
import { getProjectMembership, requireSafeRemoval } from '@/policies';

export async function removeMember(env, actor, { orgId, projectId, userId, isSelfRemoval }) {
  const db = createDb(env.DB);

  // Check target member exists
  const targetMember = await getProjectMembership(db, userId, projectId);

  if (!targetMember) {
    throw createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId, userId }, 'Member not found');
  }

  // Prevent removing the last owner
  await requireSafeRemoval(db, projectId, userId);

  await db
    .delete(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));

  // Sync member removal to DO
  try {
    await syncMemberToDO(env, projectId, 'remove', {
      userId,
    });
  } catch (err) {
    console.error('Failed to sync member removal to DO:', err);
  }

  // Send notification to removed user (if not self-removal)
  if (!isSelfRemoval) {
    try {
      const project = await db
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, projectId))
        .get();

      await notifyUser(env, userId, {
        type: NotificationTypes.PROJECT_MEMBERSHIP_REMOVED,
        orgId,
        projectId,
        projectName: project?.name || 'Unknown Project',
        removedBy: actor.name || actor.email,
      });
    } catch (err) {
      console.error('Failed to send removal notification:', err);
    }
  }

  return { removed: userId };
}
