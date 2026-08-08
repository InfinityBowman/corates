/**
 * Delete a project and clean up associated resources
 *
 * @throws DomainError DB_ERROR on database error
 */

import { captureError, info } from '../../lib/logger';
import { createDb } from '@corates/db/client';
import { projects, projectMembers } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { teardownWorkspace } from '../../sync/admin';
import { cleanupProjectStorage } from '../lib/storage';
import { notifyUsers, NotificationTypes } from '../lib/notifications';
import type { Env } from '../../types';

interface DeleteProjectActor {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface DeleteProjectParams {
  projectId: string;
}

interface DeleteProjectResult {
  deleted: string;
  notifiedCount: number;
}

export async function deleteProject(
  env: Env,
  actor: DeleteProjectActor,
  { projectId }: DeleteProjectParams,
): Promise<DeleteProjectResult> {
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

  // Clean up all PDFs from R2 storage
  try {
    await cleanupProjectStorage(env, projectId);
  } catch (err) {
    captureError(err, {
      tags: { component: 'project', action: 'delete-r2-cleanup' },
      extra: { projectId },
    });
  }

  try {
    await db.delete(projects).where(eq(projects.id, projectId));
  } catch (err) {
    throw createDomainError(
      SYSTEM_ERRORS.DB_ERROR,
      { operation: 'delete_project', projectId, originalError: (err as Error).message },
      'Failed to delete project',
    );
  }

  // Tear down the sync-engine workspace: close every session, wipe storage.
  // Workspace storage is the only home for project content, so the
  // destructive reset must come AFTER the authoritative D1 delete — if the
  // delete fails above, the project stays listed and must stay intact.
  // Best-effort from here: teardownWorkspace logs its own failures.
  await teardownWorkspace(env, projectId);

  // Send notifications to all members (except the one who deleted)
  const userIds = members.map(m => m.userId);
  const notifiedCount = await notifyUsers(
    env,
    userIds,
    {
      type: NotificationTypes.PROJECT_DELETED,
      projectId,
      projectName: project?.name || 'Unknown Project',
      deletedBy: actor.name || actor.email || 'Unknown',
    },
    actor.id,
  );

  info('project.deleted', { projectId, userId: actor.id, memberCount: members.length });

  return { deleted: projectId, notifiedCount };
}
