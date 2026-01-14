/**
 * Update a project's metadata
 *
 * @throws DomainError DB_ERROR on database error
 */

import { createDb } from '@/db/client';
import { projects } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { syncProjectToDO } from '@/commands/lib/doSync';
import type { Env } from '@/types';

export interface UpdateProjectActor {
  id: string;
}

export interface UpdateProjectParams {
  projectId: string;
  name?: string;
  description?: string;
}

export interface UpdateProjectResult {
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

  await db.update(projects).set(updateData).where(eq(projects.id, projectId));

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
