import type { Database } from '@corates/db/client';
import { captureError, info, warn } from '../../lib/logger';
import { deletedKey } from '../../lib/backup-storage';
import type { Env } from '../../types';
import { buildEnvelope, encodeEnvelope, loadProjectRows } from './envelope';

/**
 * Final copy of a project before it is deleted, kept 30 days as the undo for
 * project and account deletion. Must run before the D1 delete, because the
 * envelope carries the D1 rows and cascades remove them. Best-effort: the
 * deletion the user asked for still proceeds, but the miss is logged as a
 * backup failure so it alerts.
 */
export async function snapshotBeforeDelete(
  env: Env,
  db: Database,
  projectId: string,
  now: Date = new Date(),
): Promise<string | null> {
  try {
    const rows = await loadProjectRows(db, projectId);
    if (!rows) return null;
    const body = await encodeEnvelope(await buildEnvelope(env, rows));
    const key = deletedKey(projectId, now);
    await env.BACKUP_BUCKET.put(key, body, { httpMetadata: { contentType: 'application/gzip' } });
    info('backup.deleted_snapshot', { projectId, key, bytes: body.byteLength });
    return key;
  } catch (err) {
    warn('backup.failed', { projectId, stage: 'pre-delete' });
    captureError(err, {
      tags: { component: 'backup', action: 'pre-delete' },
      extra: { projectId },
    });
    return null;
  }
}
