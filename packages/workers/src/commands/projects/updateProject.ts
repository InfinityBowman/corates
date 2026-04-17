/**
 * Update a project's metadata
 *
 * @throws DomainError DB_ERROR on database error
 */

import { createDb } from '@corates/db/client';
import { projects } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { syncProjectToDO } from '../lib/doSync';
import type { Env } from '../../types';

interface UpdateProjectActor {
  id: string;
}

interface UpdateProjectParams {
  projectId: string;
  name?: string;
  description?: string;
}

interface UpdateProjectResult {
  projectId: string;
  updated: true;
}

export async function updateProject(
  env: Env,
  _actor: UpdateProjectActor,
  { projectId, name, description }: UpdateProjectParams,
): Promise<UpdateProjectResult> {
  const db = createDb(env.DB);
  const now = new Date();

  const trimmedName = name?.trim();
  const trimmedDescription = description?.trim();

  const updateData: { updatedAt: Date; name?: string; description?: string | null } = {
    updatedAt: now,
  };
  if (trimmedName !== undefined) updateData.name = trimmedName;
  if (trimmedDescription !== undefined) updateData.description = trimmedDescription || null;

  try {
    await db.update(projects).set(updateData).where(eq(projects.id, projectId));
  } catch (err) {
    throw createDomainError(
      SYSTEM_ERRORS.DB_ERROR,
      { operation: 'update_project', projectId, originalError: (err as Error).message },
      'Failed to update project',
    );
  }

  const metaUpdate: { updatedAt: number; name?: string; description?: string | null } = {
    updatedAt: now.getTime(),
  };
  if (trimmedName !== undefined) metaUpdate.name = trimmedName;
  if (trimmedDescription !== undefined) metaUpdate.description = trimmedDescription || null;

  try {
    await syncProjectToDO(env, projectId, metaUpdate, null);
  } catch (err) {
    console.error('Failed to sync project update to DO:', err);
  }

  return { projectId, updated: true };
}
