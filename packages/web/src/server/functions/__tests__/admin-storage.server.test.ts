/**
 * Admin storage tests.
 *
 * Tests invoke the pure business logic functions in admin-storage.server.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, seedMediaFile } from '@/__tests__/server/helpers';
import { buildAdminUser, resetCounter } from '@/__tests__/server/factories';
import type { Session } from '@/server/middleware/auth';
import {
  getAdminStorageStats,
  listAdminStorageDocuments,
  deleteAdminStorageDocuments,
} from '@/server/functions/admin-storage.server';

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
  await clearR2('projects/');
  await clearR2('invalid-key');
});

function mockAdminSession(): Session {
  return {
    user: { id: 'admin-id', email: 'admin@example.com', name: 'Admin', role: 'admin' },
    session: { id: 'admin-sess', userId: 'admin-id' },
  } as Session;
}

describe('listAdminStorageDocuments', () => {
  it('returns paginated documents', async () => {
    await putR2('projects/p1/studies/s1/file1.pdf', 'a'.repeat(100));
    await putR2('projects/p1/studies/s1/file2.pdf', 'b'.repeat(200));
    await putR2('projects/p1/studies/s2/file3.pdf', 'c'.repeat(300));

    const result = await listAdminStorageDocuments(mockAdminSession(), createDb(env.DB), {
      limit: 2,
    });
    expect(result.documents.length).toBe(2);
    expect(result.limit).toBe(2);
  });

  it('rejects invalid limit values', async () => {
    try {
      await listAdminStorageDocuments(mockAdminSession(), createDb(env.DB), { limit: 0 });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }

    try {
      await listAdminStorageDocuments(mockAdminSession(), createDb(env.DB), { limit: 99999 });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }
  });

  it('filters by search term', async () => {
    await putR2('projects/p1/studies/s1/document.pdf', 'a'.repeat(100));
    await putR2('projects/p1/studies/s1/image.jpg', 'b'.repeat(200));

    const result = await listAdminStorageDocuments(mockAdminSession(), createDb(env.DB), {
      search: 'document',
    });
    expect(result.documents.length).toBe(1);
    expect(result.documents[0].fileName).toBe('document.pdf');
  });

  it('skips keys that do not match the parseKey pattern', async () => {
    await putR2('projects/p1/studies/s1/file.pdf', 'a'.repeat(100));
    await putR2('projects/p1/studies/s2/file2.pdf', 'b'.repeat(300));
    await env.PDF_BUCKET.put('invalid-key', 'c'.repeat(50));

    const result = await listAdminStorageDocuments(mockAdminSession(), createDb(env.DB), {
      limit: 10,
    });
    expect(result.documents.length).toBe(2);
    result.documents.forEach(doc => {
      expect(doc.projectId).toBeDefined();
      expect(doc.studyId).toBeDefined();
    });

    await env.PDF_BUCKET.delete('invalid-key');
  });

  it('marks orphaned documents correctly', async () => {
    const admin = await buildAdminUser();
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-orphan';
    const projectId1 = 'po1';
    const projectId2 = 'po2';

    const { organization, projects } = await import('@corates/db/schema');
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

    const result = await listAdminStorageDocuments(mockAdminSession(), createDb(env.DB), {
      limit: 10,
    });
    const doc1 = result.documents.find(d => d.projectId === projectId1);
    const doc2 = result.documents.find(d => d.projectId === projectId2);
    expect(doc1?.orphaned).toBe(false);
    expect(doc2?.orphaned).toBe(true);
  });
});

describe('deleteAdminStorageDocuments', () => {
  it('rejects invalid key pattern', async () => {
    try {
      await deleteAdminStorageDocuments(mockAdminSession(), { keys: ['invalid-key'] });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }
  });

  it('requires at least one key', async () => {
    try {
      await deleteAdminStorageDocuments(mockAdminSession(), { keys: [] });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(400);
    }
  });

  it('deletes valid keys and reports counts', async () => {
    await putR2('projects/p1/studies/s1/file1.pdf', 'a');
    await putR2('projects/p1/studies/s1/file2.pdf', 'b');

    const result = await deleteAdminStorageDocuments(mockAdminSession(), {
      keys: ['projects/p1/studies/s1/file1.pdf', 'projects/p1/studies/s1/file2.pdf'],
    });
    expect(result.deleted).toBe(2);
    expect(result.failed).toBe(0);

    const remaining = await env.PDF_BUCKET.list({ prefix: 'projects/p1/' });
    expect(remaining.objects.length).toBe(0);
  });
});

describe('getAdminStorageStats', () => {
  it('returns storage statistics aggregated from R2', async () => {
    await putR2('projects/p1/studies/s1/file1.pdf', 'a'.repeat(100));
    await putR2('projects/p1/studies/s1/file2.pdf', 'b'.repeat(200));
    await putR2('projects/p2/studies/s1/file3.pdf', 'c'.repeat(300));

    const result = await getAdminStorageStats(mockAdminSession());
    expect(result.totalFiles).toBe(3);
    expect(result.totalSize).toBe(600);
    expect(result.filesByProject.length).toBeGreaterThan(0);
    const p1Count = result.filesByProject.find(p => p.projectId === 'p1')?.count;
    const p2Count = result.filesByProject.find(p => p.projectId === 'p2')?.count;
    expect(p1Count).toBe(2);
    expect(p2Count).toBe(1);
  });
});

void env;
