/**
 * The backup sweep and the pre-delete snapshot against the real bindings in
 * the test pool: D1 rows, the WorkspaceDO export, and an R2 bucket.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { syncApp } from '@corates/shared/sync';
import {
  resetTestDatabase,
  seedMediaFile,
  seedOrganization,
  seedProject,
  seedProjectMember,
  seedUser,
} from '../../../__tests__/helpers';
import { projectWorkspace, teardownWorkspace } from '../../../sync/admin';
import { deletedKey, snapshotKey } from '../../../lib/backup-storage';
import { deleteProject } from '../../projects/deleteProject';
import { backupWorkspaces } from '../backupWorkspaces';
import { decodeEnvelope } from '../envelope';
import { snapshotBeforeDelete } from '../snapshotBeforeDelete';

const USER = 'backup-user';
const ORG = 'backup-org';
const FULL = 'backup-project-full';
const EMPTY = 'backup-project-empty';
const NOW = new Date('2026-09-16T05:00:00.000Z');

async function clearBucket() {
  const listed = await env.BACKUP_BUCKET.list();
  if (listed.objects.length > 0) {
    await env.BACKUP_BUCKET.delete(listed.objects.map(o => o.key));
  }
}

async function keysUnder(prefix: string) {
  return (await env.BACKUP_BUCKET.list({ prefix })).objects.map(o => o.key);
}

async function readEnvelope(key: string) {
  const object = await env.BACKUP_BUCKET.get(key);
  expect(object, key).not.toBeNull();
  return decodeEnvelope(object!.body);
}

async function seedFleet() {
  const now = Date.now();
  await seedUser({
    id: USER,
    name: 'Backup',
    email: 'backup@example.com',
    createdAt: now,
    updatedAt: now,
  });
  await seedOrganization({ id: ORG, name: 'Backup Org', createdAt: now });
  for (const id of [FULL, EMPTY]) {
    await seedProject({
      id,
      name: `Project ${id}`,
      orgId: ORG,
      createdBy: USER,
      createdAt: now,
      updatedAt: now,
    });
    await seedProjectMember({
      id: `pm-${id}`,
      projectId: id,
      userId: USER,
      role: 'owner',
      joinedAt: now,
    });
  }
  await seedMediaFile({
    id: 'mf-1',
    filename: 'paper.pdf',
    bucketKey: `projects/${FULL}/paper.pdf`,
    orgId: ORG,
    projectId: FULL,
    createdAt: now,
  });
  await projectWorkspace(env, FULL).import({
    formatVersion: 1,
    schemaVersion: syncApp.version,
    rows: [
      {
        tbl: 'studies',
        id: 'study-1',
        data: { id: 'study-1', name: 'Study 1', createdAt: now, updatedAt: now },
      },
      {
        tbl: 'studies',
        id: 'study-2',
        data: { id: 'study-2', name: 'Study 2', createdAt: now, updatedAt: now },
      },
    ],
  });
  await projectWorkspace(env, EMPTY).reset();
}

describe('backupWorkspaces', () => {
  beforeEach(async () => {
    await resetTestDatabase();
    await clearBucket();
    await seedFleet();
  });

  it('writes one gzipped envelope per project per day', async () => {
    const result = await backupWorkspaces(env, createDb(env.DB), NOW);

    expect(result).toMatchObject({ projects: 2, completed: 2, failed: 0 });
    expect(result.bytes).toBeGreaterThan(0);

    const full = await readEnvelope(snapshotKey(FULL, NOW));
    expect(full.project.id).toBe(FULL);
    expect(full.members.map(m => m.userId)).toEqual([USER]);
    expect(full.mediaFiles.map(f => f.bucketKey)).toEqual([`projects/${FULL}/paper.pdf`]);
    expect(full.workspace).toMatchObject({ formatVersion: 1, schemaVersion: syncApp.version });
    expect((full.workspace.rows as unknown[]).length).toBe(2);

    const empty = await readEnvelope(snapshotKey(EMPTY, NOW));
    expect(empty.mediaFiles).toEqual([]);
    expect((empty.workspace.rows as unknown[]).length).toBe(0);
  });

  it('round-trips through the admin import', async () => {
    await backupWorkspaces(env, createDb(env.DB), NOW);
    const envelope = await readEnvelope(snapshotKey(FULL, NOW));

    await projectWorkspace(env, FULL).reset();
    const imported = await projectWorkspace(env, FULL).import(envelope.workspace);
    expect(imported.imported).toBe(2);
  });

  it('skips a failing project and keeps going', async () => {
    const bucket = env.BACKUP_BUCKET;
    const failing = {
      ...bucket,
      put: (key: string, ...rest: unknown[]) => {
        if (key.includes(FULL)) throw new Error('r2 down');
        return (bucket.put as (...args: unknown[]) => unknown)(key, ...rest);
      },
    };
    const result = await backupWorkspaces(
      { ...env, BACKUP_BUCKET: failing } as never,
      createDb(env.DB),
      NOW,
    );

    expect(result).toMatchObject({ projects: 2, completed: 1, failed: 1 });
    expect(await keysUnder(`snapshots/${FULL}/`)).toEqual([]);
    expect(await keysUnder(`snapshots/${EMPTY}/`)).toEqual([snapshotKey(EMPTY, NOW)]);
  });
});

describe('snapshotBeforeDelete and teardownWorkspace', () => {
  beforeEach(async () => {
    await resetTestDatabase();
    await clearBucket();
    await seedFleet();
  });

  it('keeps a final copy and purges the daily snapshots', async () => {
    const db = createDb(env.DB);
    await backupWorkspaces(env, db, NOW);
    expect(await keysUnder(`snapshots/${FULL}/`)).toHaveLength(1);

    const key = await snapshotBeforeDelete(env, db, FULL, NOW);
    expect(key).toBe(deletedKey(FULL, NOW));
    await teardownWorkspace(env, FULL);

    expect(await keysUnder(`snapshots/${FULL}/`)).toEqual([]);
    expect(await keysUnder(`snapshots/${EMPTY}/`)).toHaveLength(1);
    const envelope = await readEnvelope(key!);
    expect((envelope.workspace.rows as unknown[]).length).toBe(2);
    expect(((await projectWorkspace(env, FULL).stats()).rows as { live: number }).live).toBe(0);
  });

  it('returns null for an unknown project without writing', async () => {
    expect(await snapshotBeforeDelete(env, createDb(env.DB), 'no-such-project', NOW)).toBeNull();
    expect(await keysUnder('deleted/')).toEqual([]);
  });

  it('deleteProject writes the final copy with the D1 rows the delete removes', async () => {
    await deleteProject(env, { id: USER }, { projectId: FULL });

    const keys = await keysUnder(`deleted/${FULL}/`);
    expect(keys).toHaveLength(1);
    const envelope = await readEnvelope(keys[0]);
    expect(envelope.project.name).toBe(`Project ${FULL}`);
    expect(envelope.members).toHaveLength(1);
    expect(envelope.mediaFiles).toHaveLength(1);
    expect((envelope.workspace.rows as unknown[]).length).toBe(2);
  });
});
