import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import {
  resetTestDatabase,
  seedOrganization,
  seedProject,
  seedUser,
} from '../../../__tests__/helpers';
import { snapshotKey } from '../../../lib/backup-storage';
import { getBackupStatus } from '../backupStatus';

const USER = 'status-user';
const ORG = 'status-org';
const OLD = 'status-project-old';
const NEW = 'status-project-new';
const SWEEP = new Date('2026-09-16T05:00:00.000Z');
const seconds = (iso: string) => Date.parse(iso) / 1000;

async function clearBucket() {
  const listed = await env.BACKUP_BUCKET.list();
  if (listed.objects.length > 0) {
    await env.BACKUP_BUCKET.delete(listed.objects.map(o => o.key));
  }
}

describe('getBackupStatus', () => {
  beforeEach(async () => {
    await resetTestDatabase();
    await clearBucket();
    const at = seconds('2026-09-01T00:00:00.000Z');
    await seedUser({
      id: USER,
      name: 'Status',
      email: 'status@example.com',
      createdAt: at,
      updatedAt: at,
    });
    await seedOrganization({ id: ORG, name: 'Status Org', createdAt: at });
    await seedProject({
      id: OLD,
      name: 'Old',
      orgId: ORG,
      createdBy: USER,
      createdAt: at,
      updatedAt: at,
    });
    const late = seconds('2026-09-16T06:00:00.000Z');
    await seedProject({
      id: NEW,
      name: 'New',
      orgId: ORG,
      createdBy: USER,
      createdAt: late,
      updatedAt: late,
    });
  });

  it('names a project whose snapshot for the day is not in R2', async () => {
    const status = await getBackupStatus(
      env,
      createDb(env.DB),
      new Date('2026-09-16T08:00:00.000Z'),
    );
    expect(status).toEqual({
      date: '2026-09-16',
      projects: 1,
      missing: 1,
      missingProjectIds: [OLD],
    });
  });

  it('reports nothing missing once the snapshot exists', async () => {
    await env.BACKUP_BUCKET.put(snapshotKey(OLD, SWEEP), 'x');
    const status = await getBackupStatus(
      env,
      createDb(env.DB),
      new Date('2026-09-16T08:00:00.000Z'),
    );
    expect(status).toMatchObject({ date: '2026-09-16', projects: 1, missing: 0 });
  });

  it('checks the previous day until the sweep has had two hours to finish', async () => {
    await env.BACKUP_BUCKET.put(snapshotKey(OLD, new Date('2026-09-15T05:00:00.000Z')), 'x');
    const status = await getBackupStatus(
      env,
      createDb(env.DB),
      new Date('2026-09-16T06:30:00.000Z'),
    );
    expect(status).toMatchObject({ date: '2026-09-15', projects: 1, missing: 0 });
  });
});
