/**
 * Which projects are missing the snapshot the latest daily sweep should have
 * written, read from R2 itself. The Grafana backup alert polls this instead of
 * counting `backup.completed` log lines, which the log export can drop.
 */

import type { Database } from '@corates/db/client';
import { projects } from '@corates/db/schema';
import { snapshotKey } from '../../lib/backup-storage';
import type { Env } from '../../types';

// The sweep cron is `0 5 * * *` (server.ts); two more hours let it finish.
const SWEEP_HOUR_UTC = 5;
const GRACE_MS = 2 * 60 * 60 * 1000;

export interface BackupStatus {
  /** The UTC day whose snapshots were checked. */
  date: string;
  projects: number;
  missing: number;
  missingProjectIds: string[];
}

export async function getBackupStatus(
  env: Env,
  db: Database,
  now: Date = new Date(),
): Promise<BackupStatus> {
  const due = new Date(now.getTime() - SWEEP_HOUR_UTC * 60 * 60 * 1000 - GRACE_MS);
  const date = due.toISOString().slice(0, 10);
  const sweptAt = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate(),
    SWEEP_HOUR_UTC,
  );

  // A project created after that day's sweep has no snapshot yet, by design.
  const expected = (
    await db.select({ id: projects.id, createdAt: projects.createdAt }).from(projects).all()
  ).filter(p => !p.createdAt || p.createdAt.getTime() <= sweptAt);

  const heads = await Promise.all(
    expected.map(p => env.BACKUP_BUCKET.head(snapshotKey(p.id, due))),
  );
  const missingProjectIds = expected.filter((_, i) => heads[i] === null).map(p => p.id);

  return {
    date,
    projects: expected.length,
    missing: missingProjectIds.length,
    missingProjectIds,
  };
}
