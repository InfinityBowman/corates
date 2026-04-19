import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase, seedMediaFile } from '@/__tests__/server/helpers';
import {
  buildAdminUser,
  buildProject,
  buildUser,
  resetCounter,
} from '@/__tests__/server/factories';
import { handleGet as listTables } from '../database/tables';
import { handleGet as tableSchema } from '../database/tables/$tableName/schema';
import { handleGet as tableRows } from '../database/tables/$tableName/rows';
import { handleGet as pdfsByOrg } from '../database/analytics/pdfs-by-org';
import { handleGet as pdfsByUser } from '../database/analytics/pdfs-by-user';
import { handleGet as pdfsByProject } from '../database/analytics/pdfs-by-project';
import { handleGet as recentUploads } from '../database/analytics/recent-uploads';

let sessionResult: {
  user: { id: string; email: string; name: string; role?: string };
  session: { id: string; userId: string; activeOrganizationId: string | null };
} | null = null;

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => sessionResult,
}));

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  resetCounter();
  sessionResult = null;
});

async function asAdmin() {
  const admin = await buildAdminUser();
  sessionResult = {
    user: { id: admin.id, email: admin.email, name: admin.name, role: 'admin' },
    session: { id: 'admin-sess', userId: admin.id, activeOrganizationId: null },
  };
  return admin;
}

describe('GET /api/admin/database/tables', () => {
  it('returns row counts for whitelisted tables', async () => {
    await asAdmin();
    const res = await listTables();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tables: { name: string; rowCount: number }[] };
    expect(body.tables.length).toBeGreaterThan(0);
    const userTable = body.tables.find(t => t.name === 'user');
    expect(userTable).toBeDefined();
    expect(userTable!.rowCount).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/admin/database/tables/:tableName/schema', () => {
  it('returns 400 for non-whitelisted table', async () => {
    await asAdmin();
    const res = await tableSchema({
      request: new Request('http://localhost/api/admin/database/tables/sqlite_master/schema'),
      params: { tableName: 'sqlite_master' },
    });
    expect(res.status).toBe(400);
  });

  it('returns column metadata for user table', async () => {
    await asAdmin();
    const res = await tableSchema({
      request: new Request('http://localhost/api/admin/database/tables/user/schema'),
      params: { tableName: 'user' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tableName: string;
      columns: { name: string; type: string }[];
    };
    expect(body.tableName).toBe('user');
    expect(body.columns.length).toBeGreaterThan(0);
    const idCol = body.columns.find(c => c.name === 'id');
    expect(idCol).toBeDefined();
  });

  it('returns column metadata for projects table', async () => {
    await asAdmin();
    const res = await tableSchema({
      request: new Request('http://localhost/api/admin/database/tables/projects/schema'),
      params: { tableName: 'projects' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      columns: { name: string; foreignKey?: { table: string } }[];
    };
    const orgIdCol = body.columns.find(c => c.name === 'orgId');
    expect(orgIdCol).toBeDefined();
    expect(orgIdCol?.name).toBe('orgId');
  });
});

describe('GET /api/admin/database/tables/:tableName/rows', () => {
  it('returns 400 for non-whitelisted table', async () => {
    await asAdmin();
    const res = await tableRows({
      request: new Request('http://localhost/api/admin/database/tables/sqlite_master/rows'),
      params: { tableName: 'sqlite_master' },
    });
    expect(res.status).toBe(400);
  });

  it('returns paginated rows', async () => {
    await asAdmin();
    await buildUser();
    await buildUser();
    const res = await tableRows({
      request: new Request('http://localhost/api/admin/database/tables/user/rows?page=1&limit=2'),
      params: { tableName: 'user' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tableName: string;
      rows: unknown[];
      pagination: { totalRows: number; page: number; limit: number };
    };
    expect(body.tableName).toBe('user');
    expect(body.rows.length).toBeGreaterThan(0);
    expect(body.pagination.totalRows).toBeGreaterThanOrEqual(2);
    expect(body.pagination.limit).toBe(2);
  });

  it('mediaFiles path joins org/project/user', async () => {
    const admin = await asAdmin();
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

    const res = await tableRows({
      request: new Request(
        `http://localhost/api/admin/database/tables/mediaFiles/rows?filterBy=orgId&filterValue=${org.id}`,
      ),
      params: { tableName: 'mediaFiles' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rows: { orgName: string | null; projectName: string | null }[];
      pagination: { totalRows: number };
    };
    expect(body.pagination.totalRows).toBe(1);
    expect(body.rows[0].orgName).toBe(org.name);
    expect(body.rows[0].projectName).toBe(project.name);
  });

  it('mediaFiles orgSlug filter returns empty rows when slug missing', async () => {
    await asAdmin();
    const res = await tableRows({
      request: new Request(
        'http://localhost/api/admin/database/tables/mediaFiles/rows?filterBy=orgSlug&filterValue=nonexistent',
      ),
      params: { tableName: 'mediaFiles' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rows: unknown[];
      pagination: { totalRows: number };
    };
    expect(body.rows.length).toBe(0);
    expect(body.pagination.totalRows).toBe(0);
  });
});

describe('GET /api/admin/database/analytics/*', () => {
  it('pdfs-by-org returns count + total bytes per org', async () => {
    const admin = await asAdmin();
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

    const res = await pdfsByOrg();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      analytics: { orgId: string; pdfCount: number; totalStorage: number }[];
    };
    const found = body.analytics.find(a => a.orgId === org.id);
    expect(found?.pdfCount).toBe(2);
    expect(found?.totalStorage).toBe(3500);
  });

  it('pdfs-by-user filters out null uploaders', async () => {
    const admin = await asAdmin();
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

    const res = await pdfsByUser();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      analytics: { userId: string; pdfCount: number }[];
    };
    expect(body.analytics.length).toBeGreaterThanOrEqual(1);
    body.analytics.forEach(a => expect(a.userId).toBeDefined());
  });

  it('pdfs-by-project groups counts by project', async () => {
    const admin = await asAdmin();
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

    const res = await pdfsByProject();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      analytics: { projectId: string; orgId: string; pdfCount: number }[];
    };
    const found = body.analytics.find(a => a.projectId === project.id);
    expect(found?.pdfCount).toBe(1);
    expect(found?.orgId).toBe(org.id);
  });

  it('recent-uploads returns newest first with org/project/user join', async () => {
    const admin = await asAdmin();
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

    const res = await recentUploads({
      request: new Request('http://localhost/api/admin/database/analytics/recent-uploads?limit=10'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      uploads: {
        filename: string;
        org: { id: string };
        project: { id: string };
        uploadedBy: { id: string } | null;
      }[];
    };
    const filenames = body.uploads.map(u => u.filename);
    expect(filenames.indexOf('new.pdf')).toBeLessThan(filenames.indexOf('old.pdf'));
    const newUpload = body.uploads.find(u => u.filename === 'new.pdf')!;
    expect(newUpload.org.id).toBe(org.id);
    expect(newUpload.project.id).toBe(project.id);
    expect(newUpload.uploadedBy?.id).toBe(admin.id);
  });
});

void env;
