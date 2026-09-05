/**
 * Update a project member's role
 *
 * @throws DomainError LAST_OWNER if demoting the last owner
 */

import { captureError, info } from '../../lib/logger';
import { createDb } from '@corates/db/client';
import { projectMembers } from '@corates/db/schema';
import { eq, and } from 'drizzle-orm';
import { notifyUser } from '../lib/notifications';
import { requireSafeRoleChange } from '../../policies';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { refreshWorkspaceSessions } from '../../sync/admin';
import type { Env } from '../../types';
import type { ProjectRole } from '../../policies/lib/roles';

interface UpdateMemberRoleActor {
  id: string;
}

interface UpdateMemberRoleParams {
  orgId: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
}

interface UpdateMemberRoleResult {
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

  // Refresh-disconnect the project's sessions: the changed user's connection
  // re-runs authorize and picks up the fresh role stamp (the invariant
  // documented in authorize.ts), and other clients refetch the members list.
  await refreshWorkspaceSessions(env, projectId);

  // Send notification to the user whose role was updated
  try {
    await notifyUser(env, userId, {
      type: 'project-membership-updated',
      orgId,
      projectId,
      role,
    });
  } catch (err) {
    captureError(err, {
      tags: { component: 'member', action: 'role-update-notify' },
      extra: { projectId, userId },
    });
  }

  info('member.role_updated', { orgId, projectId, userId, role });

  return { userId, role };
}
