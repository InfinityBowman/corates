/**
 * Update a project member's role
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {Object} actor - User performing the action
 * @param {Object} params - Update parameters
 * @param {string} params.orgId - Organization ID
 * @param {string} params.projectId - Project ID
 * @param {string} params.userId - User ID to update
 * @param {string} params.role - New role (owner or member)
 * @returns {Promise<{ userId: string, role: string }>}
 * @throws {DomainError} LAST_OWNER if demoting the last owner
 */

import { createDb } from '@/db/client.js';
import { projectMembers } from '@/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { syncMemberToDO } from '@/commands/lib/doSync.js';
import { notifyUser, NotificationTypes } from '@/commands/lib/notifications.js';
import { requireSafeRoleChange } from '@/policies';

export async function updateMemberRole(env, actor, { orgId, projectId, userId, role }) {
  const db = createDb(env.DB);

  // Prevent demoting the last owner
  await requireSafeRoleChange(db, projectId, userId, role);

  await db
    .update(projectMembers)
    .set({ role })
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));

  // Sync role update to DO
  try {
    await syncMemberToDO(env, projectId, 'update', {
      userId,
      role,
    });
  } catch (err) {
    console.error('Failed to sync member update to DO:', err);
  }

  // Send notification to the user whose role was updated
  try {
    await notifyUser(env, userId, {
      type: NotificationTypes.PROJECT_MEMBERSHIP_UPDATED,
      orgId,
      projectId,
      role,
    });
  } catch (err) {
    console.error('Failed to send role update notification:', err);
  }

  return { userId, role };
}
