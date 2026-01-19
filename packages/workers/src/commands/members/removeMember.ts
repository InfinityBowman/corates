/**
 * Remove a member from a project
 *
 * @throws DomainError NOT_FOUND if member not found
 * @throws DomainError LAST_OWNER if removing the last owner
 */

import { createDb } from '@/db/client';
import { projectMembers, projects } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createDomainError, PROJECT_ERRORS } from '@corates/shared';
import { syncMemberWithRetry } from '@/lib/syncWithRetry';
import { notifyUser, NotificationTypes } from '@/commands/lib/notifications';
import { getProjectMembership, requireSafeRemoval } from '@/policies';
import type { Env } from '@/types';

export interface RemoveMemberActor {
  id: string;
  name?: string | null;
  email?: string | null;
}

export interface RemoveMemberParams {
  orgId: string;
  projectId: string;
  userId: string;
  isSelfRemoval: boolean;
}

export interface RemoveMemberResult {
  removed: string;
}

export async function removeMember(
  env: Env,
  actor: RemoveMemberActor,
  { orgId, projectId, userId, isSelfRemoval }: RemoveMemberParams,
): Promise<RemoveMemberResult> {
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

  // Sync member removal to DO with automatic retry
  await syncMemberWithRetry(env, projectId, 'remove', { userId });

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
        removedBy: actor.name || actor.email || 'Unknown',
      });
    } catch (err) {
      console.error('Failed to send removal notification:', err);
    }
  }

  return { removed: userId };
}
