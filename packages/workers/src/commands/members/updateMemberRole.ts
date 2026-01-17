/**
 * Update a project member's role
 *
 * @throws DomainError LAST_OWNER if demoting the last owner
 */

import { createDb } from '@/db/client';
import { projectMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { syncMemberToDO } from '@/commands/lib/doSync';
import { notifyUser, NotificationTypes } from '@/commands/lib/notifications';
import { requireSafeRoleChange } from '@/policies';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import type { Env } from '@/types';
import type { ProjectRole } from '@/policies/lib/roles';

export interface UpdateMemberRoleActor {
  id: string;
}

export interface UpdateMemberRoleParams {
  orgId: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
}

export interface UpdateMemberRoleResult {
  userId: string;
  role: ProjectRole;
}

export async function updateMemberRole(
  env: Env,
  _actor: UpdateMemberRoleActor,
  { orgId, projectId, userId, role }: UpdateMemberRoleParams,
): Promise<UpdateMemberRoleResult> {
  const db = createDb(env.DB);

  // Prevent demoting the last owner
  await requireSafeRoleChange(db, projectId, userId, role);

  try {
    await db
      .update(projectMembers)
      .set({ role })
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  } catch (err) {
    throw createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_member_role',
      cause: err instanceof Error ? err.message : String(err),
    });
  }

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
