/**
 * R2 storage cleanup for commands.
 */

import { info } from '../../lib/logger';
import type { Env } from '../../types';

/**
 * Clean up all files from R2 storage for a project
 *
 * @returns Number of deleted objects
 */
export async function cleanupProjectStorage(env: Env, projectId: string): Promise<number> {
  const prefix = `projects/${projectId}/`;
  let cursor: string | undefined = undefined;
  let deletedCount = 0;

  do {
    const listed: { objects: Array<{ key: string }>; truncated: boolean; cursor?: string } =
      await env.PDF_BUCKET.list({ prefix, cursor });

    if (listed.objects.length > 0) {
      const keysToDelete = listed.objects.map((obj: { key: string }) => obj.key);
      await Promise.all(keysToDelete.map((key: string) => env.PDF_BUCKET.delete(key)));
      deletedCount += keysToDelete.length;
    }

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  if (deletedCount > 0) {
    info('Deleted %s R2 objects for project %s', [String(deletedCount), projectId]);
  }

  return deletedCount;
}
