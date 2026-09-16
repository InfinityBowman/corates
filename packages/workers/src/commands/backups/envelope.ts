/**
 * One backup object restores one project on its own: the D1 rows that make
 * the project exist (project, members, media file records) travel with the
 * workspace snapshot so a restore never depends on D1 Time Travel.
 */

import { eq } from 'drizzle-orm';
import type { Database } from '@corates/db/client';
import { mediaFiles, projectMembers, projects } from '@corates/db/schema';
import { projectWorkspace } from '../../sync/admin';
import type { Env } from '../../types';

export interface ProjectRows {
  project: typeof projects.$inferSelect;
  members: (typeof projectMembers.$inferSelect)[];
  mediaFiles: (typeof mediaFiles.$inferSelect)[];
}

export interface BackupEnvelope extends ProjectRows {
  /** The sync-engine export, accepted back by the admin `import` op as-is. */
  workspace: Record<string, unknown>;
}

export async function loadProjectRows(
  db: Database,
  projectId: string,
): Promise<ProjectRows | null> {
  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) return null;
  const [members, files] = await Promise.all([
    db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId)).all(),
    db.select().from(mediaFiles).where(eq(mediaFiles.projectId, projectId)).all(),
  ]);
  return { project, members, mediaFiles: files };
}

export async function buildEnvelope(env: Env, rows: ProjectRows): Promise<BackupEnvelope> {
  const workspace = await projectWorkspace(env, rows.project.id).export();
  return { ...rows, workspace };
}

export async function encodeEnvelope(envelope: BackupEnvelope): Promise<ArrayBuffer> {
  const stream = new Blob([JSON.stringify(envelope)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

export async function decodeEnvelope(body: ReadableStream): Promise<BackupEnvelope> {
  return new Response(body.pipeThrough(new DecompressionStream('gzip'))).json();
}
