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
import { eq, and, count } from 'drizzle-orm';
import { createDomainError, PROJECT_ERRORS } from '@corates/shared';
import { syncMemberToDO } from '@/lib/project-sync.js';

export async function updateMemberRole(env, actor, { orgId, projectId, userId, role }) {
  const db = createDb(env.DB);

  // Prevent removing the last owner
  if (role !== 'owner') {
    const ownerCountResult = await db
      .select({ count: count() })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'owner')))
      .get();

    const targetMember = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
      .get();

    if (targetMember?.role === 'owner' && ownerCountResult?.count <= 1) {
      throw createDomainError(
        PROJECT_ERRORS.LAST_OWNER,
        { projectId },
        'Assign another owner first',
      );
    }
  }

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
    const userSessionId = env.USER_SESSION.idFromName(userId);
    const userSession = env.USER_SESSION.get(userSessionId);
    await userSession.fetch(
      new Request('https://internal/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'project-membership-updated',
          orgId,
          projectId,
          role,
          timestamp: Date.now(),
        }),
      }),
    );
  } catch (err) {
    console.error('Failed to send role update notification:', err);
  }

  return { userId, role };
}
