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
import { eq, and, count } from 'drizzle-orm';
import { createDomainError, PROJECT_ERRORS } from '@corates/shared';
import { syncMemberToDO } from '@/lib/project-sync.js';

export async function removeMember(env, actor, { orgId, projectId, userId, isSelfRemoval }) {
  const db = createDb(env.DB);

  // Check target member exists
  const targetMember = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .get();

  if (!targetMember) {
    throw createDomainError(
      PROJECT_ERRORS.NOT_FOUND,
      { projectId, userId },
      'Member not found',
    );
  }

  // Prevent removing the last owner
  if (targetMember.role === 'owner') {
    const ownerCountResult = await db
      .select({ count: count() })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'owner')))
      .get();

    if (ownerCountResult?.count <= 1) {
      throw createDomainError(
        PROJECT_ERRORS.LAST_OWNER,
        { projectId },
        'Assign another owner first or delete the project',
      );
    }
  }

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

      const userSessionId = env.USER_SESSION.idFromName(userId);
      const userSession = env.USER_SESSION.get(userSessionId);
      await userSession.fetch(
        new Request('https://internal/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'project-membership-removed',
            orgId,
            projectId,
            projectName: project?.name || 'Unknown Project',
            removedBy: actor.name || actor.email,
            timestamp: Date.now(),
          }),
        }),
      );
    } catch (err) {
      console.error('Failed to send removal notification:', err);
    }
  }

  return { removed: userId };
}
