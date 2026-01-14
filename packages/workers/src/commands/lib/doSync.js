/**
 * Durable Object sync utilities for commands
 *
 * Consolidates DO sync operations used across commands.
 * Re-exports from project-sync.js and adds additional helpers.
 */

import { getProjectDocStub } from '@/lib/project-doc-id.js';

// Re-export existing sync functions
export { syncProjectToDO, syncMemberToDO } from '@/lib/project-sync.js';

/**
 * Disconnect all connected users from a ProjectDoc Durable Object
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} projectId - Project ID
 * @returns {Promise<void>}
 */
export async function disconnectAllFromProject(env, projectId) {
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
}

/**
 * Clean up all files from R2 storage for a project
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Number of deleted objects
 */
export async function cleanupProjectStorage(env, projectId) {
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

  return deletedCount;
}
