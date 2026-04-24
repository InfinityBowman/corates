/**
 * Admin database browser tests.
 *
 * Tests invoke the pure business logic functions in admin-database.server.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
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
  getAdminPdfsByOrg,
  getAdminPdfsByUser,
  getAdminPdfsByProject,
  getAdminRecentUploads,
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
      expect((err as Response).status).toBe(400);
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
      expect((err as Response).status).toBe(400);
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
    expect(result.pagination.limit).toBe(2);
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

describe('analytics', () => {
  it('pdfs-by-org returns count + total bytes per org', async () => {
    const admin = await buildAdminUser();
    const { project, org } = await buildProject();
    await seedMediaFile({
      id: 'mf-an-1',
      filename: 'a.pdf',
      fileSize: 1000,
      bucketKey: `projects/${project.id}/studies/s1/a.pdf`,
      orgId: org.id,
      projectId: project.id,
      studyId: 's1',
      uploadedBy: admin.id,
      createdAt: Math.floor(Date.now() / 1000),
    });
    await seedMediaFile({
      id: 'mf-an-2',
      filename: 'b.pdf',
      fileSize: 2500,
      bucketKey: `projects/${project.id}/studies/s1/b.pdf`,
      orgId: org.id,
      projectId: project.id,
      studyId: 's1',
      uploadedBy: admin.id,
      createdAt: Math.floor(Date.now() / 1000),
    });

    const result = await getAdminPdfsByOrg(mockAdminSession(), createDb(env.DB));
    const found = result.analytics.find(a => a.orgId === org.id);
    expect(found?.pdfCount).toBe(2);
    expect(found?.totalStorage).toBe(3500);
  });

  it('pdfs-by-user filters out null uploaders', async () => {
    const admin = await buildAdminUser();
    const { project, org } = await buildProject();
    await seedMediaFile({
      id: 'mf-an-u',
      filename: 'a.pdf',
      bucketKey: `projects/${project.id}/studies/s1/a.pdf`,
      orgId: org.id,
      projectId: project.id,
      studyId: 's1',
      uploadedBy: admin.id,
      createdAt: Math.floor(Date.now() / 1000),
    });

    const result = await getAdminPdfsByUser(mockAdminSession(), createDb(env.DB));
    expect(result.analytics.length).toBeGreaterThanOrEqual(1);
    result.analytics.forEach(a => expect(a.userId).toBeDefined());
  });

  it('pdfs-by-project groups counts by project', async () => {
    const admin = await buildAdminUser();
    const { project, org } = await buildProject();
    await seedMediaFile({
      id: 'mf-an-p',
      filename: 'a.pdf',
      bucketKey: `projects/${project.id}/studies/s1/a.pdf`,
      orgId: org.id,
      projectId: project.id,
      studyId: 's1',
      uploadedBy: admin.id,
      createdAt: Math.floor(Date.now() / 1000),
    });

    const result = await getAdminPdfsByProject(mockAdminSession(), createDb(env.DB));
    const found = result.analytics.find(a => a.projectId === project.id);
    expect(found?.pdfCount).toBe(1);
    expect(found?.orgId).toBe(org.id);
  });

  it('recent-uploads returns newest first with org/project/user join', async () => {
    const admin = await buildAdminUser();
    const { project, org } = await buildProject();
    const base = Math.floor(Date.now() / 1000);
    await seedMediaFile({
      id: 'mf-recent-old',
      filename: 'old.pdf',
      bucketKey: `projects/${project.id}/studies/s1/old.pdf`,
      orgId: org.id,
      projectId: project.id,
      studyId: 's1',
      uploadedBy: admin.id,
      createdAt: base - 1000,
    });
    await seedMediaFile({
      id: 'mf-recent-new',
      filename: 'new.pdf',
      bucketKey: `projects/${project.id}/studies/s1/new.pdf`,
      orgId: org.id,
      projectId: project.id,
      studyId: 's1',
      uploadedBy: admin.id,
      createdAt: base,
    });

    const result = await getAdminRecentUploads(mockAdminSession(), createDb(env.DB), { limit: 10 });
    const filenames = result.uploads.map(u => u.filename);
    expect(filenames.indexOf('new.pdf')).toBeLessThan(filenames.indexOf('old.pdf'));
    const newUpload = result.uploads.find(u => u.filename === 'new.pdf')!;
    expect(newUpload.org.id).toBe(org.id);
    expect(newUpload.project.id).toBe(project.id);
    expect(newUpload.uploadedBy?.id).toBe(admin.id);
  });
});

void env;
