/**
 * Key layout of the project backup bucket. Retention is enforced by R2
 * lifecycle rules on these prefixes (see docs/guides/database.md), so the
 * prefixes are the contract: an object under `snapshots/` lives 60 days, one
 * under `deleted-accounts/` lives 30 days, and one under `deleted/` is kept
 * forever.
 */

import type { Env } from '../types';

export const SNAPSHOT_PREFIX = 'snapshots';
export const DELETED_PREFIX = 'deleted';
export const ACCOUNT_DELETED_PREFIX = 'deleted-accounts';

/** `snapshots/<projectId>/<YYYY-MM-DD>.json.gz`, one per project per day. */
export function snapshotKey(projectId: string, at: Date): string {
  return `${SNAPSHOT_PREFIX}/${projectId}/${at.toISOString().slice(0, 10)}.json.gz`;
}

/** `deleted/<projectId>/<ISO datetime>.json.gz`, written once when a project is deleted. */
export function deletedKey(projectId: string, at: Date): string {
  return `${DELETED_PREFIX}/${projectId}/${at.toISOString()}.json.gz`;
}

/**
 * `deleted-accounts/<projectId>/<ISO datetime>.json.gz`, for a sole-owned
 * project removed with its owner's account. It expires so account deletion
 * still erases the user's submissions, as the terms promise.
 */
export function accountDeletedKey(projectId: string, at: Date): string {
  return `${ACCOUNT_DELETED_PREFIX}/${projectId}/${at.toISOString()}.json.gz`;
}

/** Removes every daily snapshot of a project once its final deletion copy exists. */
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
