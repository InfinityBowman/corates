/**
 * Update a project's metadata
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {Object} actor - User performing the update
 * @param {Object} params - Update parameters
 * @param {string} params.projectId - Project ID
 * @param {string} [params.name] - New project name
 * @param {string} [params.description] - New project description
 * @returns {Promise<{ projectId: string, updated: true }>}
 * @throws {DomainError} DB_ERROR on database error
 */

import { createDb } from '@/db/client.js';
import { projects } from '@/db/schema.js';
import { eq } from 'drizzle-orm';
import { syncProjectToDO } from '@/commands/lib/doSync.js';

export async function updateProject(env, actor, { projectId, name, description }) {
  const db = createDb(env.DB);
  const now = new Date();

  const trimmedName = name?.trim();
  const trimmedDescription = description?.trim();

  const updateData = { updatedAt: now };
  if (trimmedName !== undefined) updateData.name = trimmedName;
  if (trimmedDescription !== undefined) updateData.description = trimmedDescription || null;

  await db.update(projects).set(updateData).where(eq(projects.id, projectId));

  const metaUpdate = { updatedAt: now.getTime() };
  if (trimmedName !== undefined) metaUpdate.name = trimmedName;
  if (trimmedDescription !== undefined) metaUpdate.description = trimmedDescription || null;

  try {
    await syncProjectToDO(env, projectId, metaUpdate, null);
  } catch (err) {
    console.error('Failed to sync project update to DO:', err);
  }

  return { projectId, updated: true };
}
