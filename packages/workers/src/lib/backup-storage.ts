/**
 * Key layout of the workspace backup bucket. Retention is enforced by R2
 * lifecycle rules on these prefixes (see docs/guides/database.md), so the
 * prefixes are the contract: an object under `snapshots/` lives 60 days, one
 * under `deleted/` lives 30 days.
 */

import type { Env } from '../types';

export const SNAPSHOT_PREFIX = 'snapshots';
export const DELETED_PREFIX = 'deleted';

/** `snapshots/<projectId>/<YYYY-MM-DD>.json.gz`, one per project per day. */
export function snapshotKey(projectId: string, at: Date): string {
  return `${SNAPSHOT_PREFIX}/${projectId}/${at.toISOString().slice(0, 10)}.json.gz`;
}

/** `deleted/<projectId>/<ISO datetime>.json.gz`, written once at teardown. */
export function deletedKey(projectId: string, at: Date): string {
  return `${DELETED_PREFIX}/${projectId}/${at.toISOString()}.json.gz`;
}

/** Removes every daily snapshot of a project once its final `deleted/` copy exists. */
export async function purgeProjectSnapshots(env: Env, projectId: string): Promise<number> {
  const prefix = `${SNAPSHOT_PREFIX}/${projectId}/`;
  let cursor: string | undefined;
  let deleted = 0;
  do {
    const listed: { objects: Array<{ key: string }>; truncated: boolean; cursor?: string } =
      await env.BACKUP_BUCKET.list({ prefix, cursor });
    if (listed.objects.length > 0) {
      await env.BACKUP_BUCKET.delete(listed.objects.map((o: { key: string }) => o.key));
      deleted += listed.objects.length;
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return deleted;
}
