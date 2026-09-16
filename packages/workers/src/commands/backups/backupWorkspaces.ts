/**
 * Daily sweep that writes every project's workspace to the backup bucket.
 *
 * Every project every day, changed or not: no "latest" pointer, no skip
 * logic, no bookkeeping to get wrong. A project that fails is logged and
 * skipped so one broken workspace cannot hide the rest of the fleet. The
 * D1 rows are read fleet-wide up front so the per-project cost is one DO
 * call and one R2 put, which keeps a single invocation under the subrequest
 * cap until the fleet nears a few hundred projects.
 */

import type { Database } from '@corates/db/client';
import { mediaFiles, projectMembers, projects } from '@corates/db/schema';
import { captureError, info, warn } from '../../lib/logger';
import { snapshotKey } from '../../lib/backup-storage';
import type { Env } from '../../types';
import { buildEnvelope, encodeEnvelope, type ProjectRows } from './envelope';

export interface BackupSweepResult {
  projects: number;
  completed: number;
  failed: number;
  bytes: number;
}

function groupBy<T extends { projectId: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.projectId) ?? [];
    list.push(row);
    grouped.set(row.projectId, list);
  }
  return grouped;
}

export async function backupWorkspaces(
  env: Env,
  db: Database,
  now: Date = new Date(),
): Promise<BackupSweepResult> {
  const [allProjects, allMembers, allFiles] = await Promise.all([
    db.select().from(projects).all(),
    db.select().from(projectMembers).all(),
    db.select().from(mediaFiles).all(),
  ]);
  const membersByProject = groupBy(allMembers);
  const filesByProject = groupBy(allFiles);

  const result: BackupSweepResult = {
    projects: allProjects.length,
    completed: 0,
    failed: 0,
    bytes: 0,
  };

  for (const project of allProjects) {
    const rows: ProjectRows = {
      project,
      members: membersByProject.get(project.id) ?? [],
      mediaFiles: filesByProject.get(project.id) ?? [],
    };
    try {
      const body = await encodeEnvelope(await buildEnvelope(env, rows));
      await env.BACKUP_BUCKET.put(snapshotKey(project.id, now), body, {
        httpMetadata: { contentType: 'application/gzip' },
      });
      result.completed += 1;
      result.bytes += body.byteLength;
    } catch (err) {
      result.failed += 1;
      warn('backup.failed', { projectId: project.id, stage: 'sweep' });
      captureError(err, {
        tags: { component: 'backup', action: 'sweep' },
        extra: { projectId: project.id },
      });
    }
  }

  info('backup.completed', { ...result, date: now.toISOString().slice(0, 10) });
  return result;
}
