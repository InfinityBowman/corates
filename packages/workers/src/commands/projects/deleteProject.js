/**
 * Delete a project and clean up associated resources
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {Object} actor - User performing the deletion
 * @param {Object} params - Delete parameters
 * @param {string} params.projectId - Project ID to delete
 * @returns {Promise<{ deleted: string, notifiedCount: number }>}
 * @throws {DomainError} DB_ERROR on database error
 */

import { createDb } from '@/db/client.js';
import { projects, projectMembers } from '@/db/schema.js';
import { eq } from 'drizzle-orm';
import { getProjectDocStub } from '@/lib/project-doc-id.js';

export async function deleteProject(env, actor, { projectId }) {
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
    const projectDoc = getProjectDocStub(env, projectId);
    await projectDoc.fetch(
      new Request('https://internal/disconnect-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true',
        },
      }),
    );
  } catch (err) {
    console.error('Failed to disconnect users from DO:', err);
  }

  // Clean up all PDFs from R2 storage
  try {
    const prefix = `projects/${projectId}/`;
    let cursor = undefined;
    let deletedCount = 0;

    do {
      const listed = await env.PDF_BUCKET.list({ prefix, cursor });

      if (listed.objects.length > 0) {
        const keysToDelete = listed.objects.map(obj => obj.key);
        await Promise.all(keysToDelete.map(key => env.PDF_BUCKET.delete(key)));
        deletedCount += keysToDelete.length;
      }

      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    if (deletedCount > 0) {
      console.log(`Deleted ${deletedCount} R2 objects for project ${projectId}`);
    }
  } catch (err) {
    console.error('Failed to clean up R2 files for project:', projectId, err);
  }

  await db.delete(projects).where(eq(projects.id, projectId));

  // Send notifications to all members (except the one who deleted)
  let notifiedCount = 0;
  for (const member of members) {
    if (member.userId !== actor.id) {
      try {
        const userSessionId = env.USER_SESSION.idFromName(member.userId);
        const userSession = env.USER_SESSION.get(userSessionId);
        await userSession.fetch(
          new Request('https://internal/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'project-deleted',
              projectId,
              projectName: project?.name || 'Unknown Project',
              deletedBy: actor.name || actor.email,
              timestamp: Date.now(),
            }),
          }),
        );
        notifiedCount++;
      } catch (err) {
        console.error('Failed to send deletion notification to user:', member.userId, err);
      }
    }
  }

  return { deleted: projectId, notifiedCount };
}
