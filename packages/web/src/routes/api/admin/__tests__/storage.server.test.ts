import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase, seedMediaFile } from '@/__tests__/server/helpers';
import { buildAdminUser, buildUser, resetCounter } from '@/__tests__/server/factories';
import { handleGet as listDocs, handleDelete as deleteDocs } from '../storage/documents';
import { handleGet as getStats } from '../storage/stats';

let sessionResult: {
  user: { id: string; email: string; name: string; role?: string };
  session: { id: string; userId: string; activeOrganizationId: string | null };
} | null = null;

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => sessionResult,
}));

async function clearR2(prefix: string) {
  const listed = await env.PDF_BUCKET.list({ prefix });
  for (const obj of listed.objects) {
    await env.PDF_BUCKET.delete(obj.key);
  }
}

async function putR2(key: string, body: string) {
  await env.PDF_BUCKET.put(key, body);
}

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  resetCounter();
  sessionResult = null;
  await clearR2('projects/');
  await clearR2('invalid-key');
});

async function asAdmin() {
  const admin = await buildAdminUser();
  sessionResult = {
    user: { id: admin.id, email: admin.email, name: admin.name, role: 'admin' },
    session: { id: 'admin-sess', userId: admin.id, activeOrganizationId: null },
  };
  return admin;
}

function listReq(path = '/api/admin/storage/documents'): Request {
  return new Request(`http://localhost${path}`);
}

function deleteReq(body: unknown): Request {
  return new Request('http://localhost/api/admin/storage/documents', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/admin/storage/documents', () => {
  it('returns 401 when no session', async () => {
    const res = await listDocs({ request: listReq() });
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not admin', async () => {
    const user = await buildUser();
    sessionResult = {
      user: { id: user.id, email: user.email, name: user.name, role: 'user' },
      session: { id: 'sess', userId: user.id, activeOrganizationId: null },
    };
    const res = await listDocs({ request: listReq() });
    expect(res.status).toBe(403);
  });

  it('returns paginated documents', async () => {
    await asAdmin();
    await putR2('projects/p1/studies/s1/file1.pdf', 'a'.repeat(100));
    await putR2('projects/p1/studies/s1/file2.pdf', 'b'.repeat(200));
    await putR2('projects/p1/studies/s2/file3.pdf', 'c'.repeat(300));

    const res = await listDocs({ request: listReq('/api/admin/storage/documents?limit=2') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      documents: { fileName: string }[];
      limit: number;
      nextCursor?: string;
    };
    expect(body.documents.length).toBe(2);
    expect(body.limit).toBe(2);
  });

  it('rejects invalid limit values', async () => {
    await asAdmin();
    const res1 = await listDocs({ request: listReq('/api/admin/storage/documents?limit=0') });
    expect(res1.status).toBe(400);
    const res2 = await listDocs({ request: listReq('/api/admin/storage/documents?limit=99999') });
    expect(res2.status).toBe(400);
  });

  it('filters by search term', async () => {
    await asAdmin();
    await putR2('projects/p1/studies/s1/document.pdf', 'a'.repeat(100));
    await putR2('projects/p1/studies/s1/image.jpg', 'b'.repeat(200));

    const res = await listDocs({
      request: listReq('/api/admin/storage/documents?search=document'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { documents: { fileName: string }[] };
    expect(body.documents.length).toBe(1);
    expect(body.documents[0].fileName).toBe('document.pdf');
  });

  it('skips keys that do not match the parseKey pattern', async () => {
    await asAdmin();
    await putR2('projects/p1/studies/s1/file.pdf', 'a'.repeat(100));
    await putR2('projects/p1/studies/s2/file2.pdf', 'b'.repeat(300));
    await env.PDF_BUCKET.put('invalid-key', 'c'.repeat(50));

    const res = await listDocs({ request: listReq('/api/admin/storage/documents?limit=10') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { documents: { projectId: string; studyId: string }[] };
    expect(body.documents.length).toBe(2);
    body.documents.forEach(doc => {
      expect(doc.projectId).toBeDefined();
      expect(doc.studyId).toBeDefined();
    });

    await env.PDF_BUCKET.delete('invalid-key');
  });

  it('marks orphaned documents correctly', async () => {
    const admin = await asAdmin();
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-orphan';
    const projectId1 = 'po1';
    const projectId2 = 'po2';

    const { organization, projects } = await import('@corates/db/schema');
    const { createDb } = await import('@corates/db/client');
    const db = createDb(env.DB);
    await db.insert(organization).values({
      id: orgId,
      name: 'Orphan Test Org',
      slug: 'orphan-test',
      createdAt: new Date(nowSec * 1000),
    });
    await db.insert(projects).values({
      id: projectId1,
      name: 'Project 1',
      orgId,
      createdBy: admin.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await seedMediaFile({
      id: 'media-1',
      filename: 'file1.pdf',
      bucketKey: `projects/${projectId1}/studies/s1/file1.pdf`,
      orgId,
      projectId: projectId1,
      studyId: 's1',
      uploadedBy: admin.id,
      createdAt: nowSec,
    });

    await putR2(`projects/${projectId1}/studies/s1/file1.pdf`, 'a'.repeat(100));
    await putR2(`projects/${projectId2}/studies/s1/file2.pdf`, 'b'.repeat(200));

    const res = await listDocs({ request: listReq('/api/admin/storage/documents?limit=10') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { documents: { projectId: string; orphaned: boolean }[] };
    const doc1 = body.documents.find(d => d.projectId === projectId1);
    const doc2 = body.documents.find(d => d.projectId === projectId2);
    expect(doc1?.orphaned).toBe(false);
    expect(doc2?.orphaned).toBe(true);
  });
});

describe('DELETE /api/admin/storage/documents', () => {
  it('returns 401 when no session', async () => {
    const res = await deleteDocs({ request: deleteReq({ keys: ['projects/p/studies/s/f.pdf'] }) });
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not admin', async () => {
    const user = await buildUser();
    sessionResult = {
      user: { id: user.id, email: user.email, name: user.name, role: 'user' },
      session: { id: 'sess', userId: user.id, activeOrganizationId: null },
    };
    const res = await deleteDocs({ request: deleteReq({ keys: ['projects/p/studies/s/f.pdf'] }) });
    expect(res.status).toBe(403);
  });

  it('rejects invalid key pattern', async () => {
    await asAdmin();
    const res = await deleteDocs({ request: deleteReq({ keys: ['invalid-key'] }) });
    expect(res.status).toBe(400);
  });

  it('requires at least one key', async () => {
    await asAdmin();
    const res = await deleteDocs({ request: deleteReq({ keys: [] }) });
    expect(res.status).toBe(400);
  });

  it('deletes valid keys and reports counts', async () => {
    await asAdmin();
    await putR2('projects/p1/studies/s1/file1.pdf', 'a');
    await putR2('projects/p1/studies/s1/file2.pdf', 'b');

    const res = await deleteDocs({
      request: deleteReq({
        keys: ['projects/p1/studies/s1/file1.pdf', 'projects/p1/studies/s1/file2.pdf'],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { deleted: number; failed: number };
    expect(body.deleted).toBe(2);
    expect(body.failed).toBe(0);

    const remaining = await env.PDF_BUCKET.list({ prefix: 'projects/p1/' });
    expect(remaining.objects.length).toBe(0);
  });
});

describe('GET /api/admin/storage/stats', () => {
  it('returns 401 when no session', async () => {
    const res = await getStats({
      request: new Request('http://localhost/api/admin/storage/stats'),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not admin', async () => {
    const user = await buildUser();
    sessionResult = {
      user: { id: user.id, email: user.email, name: user.name, role: 'user' },
      session: { id: 'sess', userId: user.id, activeOrganizationId: null },
    };
    const res = await getStats({
      request: new Request('http://localhost/api/admin/storage/stats'),
    });
    expect(res.status).toBe(403);
  });

  it('returns storage statistics aggregated from R2', async () => {
    await asAdmin();
    await putR2('projects/p1/studies/s1/file1.pdf', 'a'.repeat(100));
    await putR2('projects/p1/studies/s1/file2.pdf', 'b'.repeat(200));
    await putR2('projects/p2/studies/s1/file3.pdf', 'c'.repeat(300));

    const res = await getStats({
      request: new Request('http://localhost/api/admin/storage/stats'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      totalFiles: number;
      totalSize: number;
      filesByProject: { projectId: string; count: number }[];
    };
    expect(body.totalFiles).toBe(3);
    expect(body.totalSize).toBe(600);
    expect(body.filesByProject.length).toBeGreaterThan(0);
    const p1Count = body.filesByProject.find(p => p.projectId === 'p1')?.count;
    const p2Count = body.filesByProject.find(p => p.projectId === 'p2')?.count;
    expect(p1Count).toBe(2);
    expect(p2Count).toBe(1);
  });
});
