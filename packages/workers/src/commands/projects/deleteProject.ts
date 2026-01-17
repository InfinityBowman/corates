/**
 * Delete a project and clean up associated resources
 *
 * @throws DomainError DB_ERROR on database error
 */

import { createDb } from '@/db/client';
import { projects, projectMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { disconnectAllFromProject, cleanupProjectStorage } from '@/commands/lib/doSync';
import { notifyUsers, NotificationTypes } from '@/commands/lib/notifications';
import type { Env } from '@/types';

export interface DeleteProjectActor {
  id: string;
  name?: string | null;
  email?: string | null;
}

export interface DeleteProjectParams {
  projectId: string;
}

export interface DeleteProjectResult {
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
      { operation: 'delete_project', projectId, originalError: (err as Error).message },
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
      deletedBy: actor.name || actor.email || 'Unknown',
    },
    actor.id,
  );

  return { deleted: projectId, notifiedCount };
}
