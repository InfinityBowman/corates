/**
 * Admin database browser tests.
 *
 * Tests invoke the pure business logic functions in admin-database.server.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { DomainErrorException } from '@corates/shared';
import { resetTestDatabase, seedMediaFile } from '@/__tests__/server/helpers';
import {
  buildAdminUser,
  buildProject,
  buildUser,
  resetCounter,
} from '@/__tests__/server/factories';
import type { Session } from '@/server/middleware/auth';
import {
  listAdminDatabaseTables,
  getAdminTableSchema,
  getAdminTableRows,
} from '@/server/functions/admin-database.server';

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  resetCounter();
});

function mockAdminSession(): Session {
  return {
    user: { id: 'admin-id', email: 'admin@example.com', name: 'Admin', role: 'admin' },
    session: { id: 'admin-sess', userId: 'admin-id' },
  } as Session;
}

describe('listAdminDatabaseTables', () => {
  it('returns row counts for whitelisted tables', async () => {
    await buildAdminUser();
    const result = await listAdminDatabaseTables(mockAdminSession(), createDb(env.DB));
    expect(result.tables.length).toBeGreaterThan(0);
    const userTable = result.tables.find(t => t.name === 'user');
    expect(userTable).toBeDefined();
    expect(userTable!.rowCount).toBeGreaterThanOrEqual(1);
  });
});

describe('getAdminTableSchema', () => {
  it('throws 400 for non-whitelisted table', () => {
    try {
      getAdminTableSchema(mockAdminSession(), 'sqlite_master');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as DomainErrorException).statusCode).toBe(403);
    }
  });

  it('returns column metadata for user table', () => {
    const result = getAdminTableSchema(mockAdminSession(), 'user');
    expect(result.tableName).toBe('user');
    expect(result.columns.length).toBeGreaterThan(0);
    const idCol = result.columns.find(c => c.name === 'id');
    expect(idCol).toBeDefined();
  });

  it('returns column metadata for projects table', () => {
    const result = getAdminTableSchema(mockAdminSession(), 'projects');
    const orgIdCol = result.columns.find(c => c.name === 'orgId');
    expect(orgIdCol).toBeDefined();
    expect(orgIdCol?.name).toBe('orgId');
  });
});

describe('getAdminTableRows', () => {
  it('throws 400 for non-whitelisted table', async () => {
    try {
      await getAdminTableRows(mockAdminSession(), createDb(env.DB), 'sqlite_master', {});
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as DomainErrorException).statusCode).toBe(403);
    }
  });

  it('returns paginated rows', async () => {
    await buildAdminUser();
    await buildUser();
    await buildUser();
    const result = await getAdminTableRows(mockAdminSession(), createDb(env.DB), 'user', {
      page: 1,
      limit: 2,
    });
    expect(result.tableName).toBe('user');
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.pagination.totalRows).toBeGreaterThanOrEqual(2);
  });

  it('mediaFiles path joins org/project/user', async () => {
    const admin = await buildAdminUser();
    const { project, org } = await buildProject();
    await seedMediaFile({
      id: 'mf-rows-1',
      filename: 'a.pdf',
      bucketKey: `projects/${project.id}/studies/s1/a.pdf`,
      orgId: org.id,
      projectId: project.id,
      studyId: 's1',
      uploadedBy: admin.id,
      createdAt: Math.floor(Date.now() / 1000),
    });

    const result = await getAdminTableRows(mockAdminSession(), createDb(env.DB), 'mediaFiles', {
      filterBy: 'orgId',
      filterValue: org.id,
    });
    expect(result.pagination.totalRows).toBe(1);
    const rows = result.rows as Array<{ orgName: string | null; projectName: string | null }>;
    expect(rows[0].orgName).toBe(org.name);
    expect(rows[0].projectName).toBe(project.name);
  });

  it('mediaFiles orgSlug filter returns empty rows when slug missing', async () => {
    await buildAdminUser();
    const result = await getAdminTableRows(mockAdminSession(), createDb(env.DB), 'mediaFiles', {
      filterBy: 'orgSlug',
      filterValue: 'nonexistent',
    });
    expect(result.rows.length).toBe(0);
    expect(result.pagination.totalRows).toBe(0);
  });
});

void env;
