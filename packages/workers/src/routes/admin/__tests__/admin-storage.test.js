/**
 * Tests for admin storage routes
 * Tests R2 document listing, deletion, and statistics
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { resetTestDatabase, seedUser, seedOrganization, seedProject, json } from '../../../__tests__/helpers.js';

vi.mock('../../../middleware/requireAdmin.js', () => {
  return {
    isAdmin: () => true,
    requireAdmin: async (c, next) => {
      c.set('user', {
        id: 'admin-user',
        role: 'admin',
        email: 'admin@example.com',
        name: 'Admin User',
      });
      c.set('session', { id: 'admin-session' });
      c.set('isAdmin', true);
      await next();
    },
  };
});

let app;

async function fetchApp(path, init = {}, envOverrides = {}) {
  const testEnv = {
    ...env,
    ...envOverrides,
  };
  const ctx = createExecutionContext();
  const req = new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      origin: 'http://localhost:5173',
      ...init.headers,
    },
  });
  const res = await app.fetch(req, testEnv, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

beforeAll(async () => {
  const { storageRoutes } = await import('../storage.js');
  app = new Hono();
  app.route('/api/admin', storageRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});

describe('Admin storage routes - GET /api/admin/storage/documents', () => {
  it('should return paginated documents with cursor', async () => {
    const mockR2 = {
      list: vi.fn()
        .mockResolvedValueOnce({
          objects: [
            { key: 'projects/p1/studies/s1/file1.pdf', size: 100, uploaded: new Date(), etag: 'etag1' },
            { key: 'projects/p1/studies/s1/file2.pdf', size: 200, uploaded: new Date(), etag: 'etag2' },
          ],
          truncated: true,
          cursor: 'cursor-page2',
        })
        .mockResolvedValueOnce({
          objects: [{ key: 'projects/p1/studies/s2/file3.pdf', size: 300, uploaded: new Date(), etag: 'etag3' }],
          truncated: false,
        }),
      get: async () => null,
      put: async () => ({ key: 'test-key' }),
      delete: async () => {},
    };

    const res = await fetchApp('/api/admin/storage/documents?limit=2', {}, { PDF_BUCKET: mockR2 });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.documents).toBeDefined();
    expect(body.documents.length).toBe(2);
    expect(body.nextCursor).toBeDefined();
    expect(body.limit).toBe(2);

    const cursor = JSON.parse(body.nextCursor);
    expect(cursor.r2Cursor).toBe('cursor-page2');
    expect(cursor.skipCount).toBe(2);
  });

  it('should handle composite cursor correctly', async () => {
    const mockR2 = {
      list: vi.fn().mockResolvedValueOnce({
        objects: [{ key: 'projects/p1/studies/s1/file1.pdf', size: 100, uploaded: new Date(), etag: 'etag1' }],
        truncated: false,
      }),
      get: async () => null,
      put: async () => ({ key: 'test-key' }),
      delete: async () => {},
    };

    const cursorData = JSON.stringify({ r2Cursor: 'cursor-test', skipCount: 5 });
    const res = await fetchApp(
      `/api/admin/storage/documents?limit=10&cursor=${encodeURIComponent(cursorData)}`,
      {},
      { PDF_BUCKET: mockR2 },
    );

    expect(res.status).toBe(200);
    expect(mockR2.list).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: 'cursor-test',
      }),
    );
  });

  it('should reject invalid limit values', async () => {
    const mockR2 = {
      list: async () => ({ objects: [], truncated: false }),
      get: async () => null,
      put: async () => ({ key: 'test-key' }),
      delete: async () => {},
    };

    const res1 = await fetchApp('/api/admin/storage/documents?limit=0', {}, { PDF_BUCKET: mockR2 });
    expect(res1.status).toBe(400);

    const res2 = await fetchApp('/api/admin/storage/documents?limit=99999', {}, { PDF_BUCKET: mockR2 });
    expect(res2.status).toBe(400);
  });

  it('should filter by search term', async () => {
    const mockR2 = {
      list: vi.fn().mockResolvedValueOnce({
        objects: [
          { key: 'projects/p1/studies/s1/document.pdf', size: 100, uploaded: new Date(), etag: 'etag1' },
          { key: 'projects/p1/studies/s1/image.jpg', size: 200, uploaded: new Date(), etag: 'etag2' },
        ],
        truncated: false,
      }),
      get: async () => null,
      put: async () => ({ key: 'test-key' }),
      delete: async () => {},
    };

    const res = await fetchApp('/api/admin/storage/documents?search=document', {}, { PDF_BUCKET: mockR2 });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.documents.length).toBe(1);
    expect(body.documents[0].fileName).toBe('document.pdf');
  });

  it('should filter out keys that do not match parseKey pattern', async () => {
    const mockR2 = {
      list: vi.fn().mockResolvedValueOnce({
        objects: [
          { key: 'projects/p1/studies/s1/file.pdf', size: 100, uploaded: new Date(), etag: 'etag1' },
          { key: 'invalid-key', size: 200, uploaded: new Date(), etag: 'etag2' },
          { key: 'projects/p1/studies/s2/file2.pdf', size: 300, uploaded: new Date(), etag: 'etag3' },
        ],
        truncated: false,
      }),
      get: async () => null,
      put: async () => ({ key: 'test-key' }),
      delete: async () => {},
    };

    const res = await fetchApp('/api/admin/storage/documents?limit=10', {}, { PDF_BUCKET: mockR2 });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.documents.length).toBe(2);
    body.documents.forEach(doc => {
      expect(doc.projectId).toBeDefined();
      expect(doc.studyId).toBeDefined();
    });
  });

  it('should mark orphaned documents correctly', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';
    const projectId1 = 'p1';
    const projectId2 = 'p2';
    const userId = 'user-1';

    await seedUser({
      id: userId,
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedProject({
      id: projectId1,
      name: 'Project 1',
      orgId,
      createdBy: userId,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const mockR2 = {
      list: vi.fn().mockResolvedValueOnce({
        objects: [
          { key: `projects/${projectId1}/studies/s1/file1.pdf`, size: 100, uploaded: new Date(), etag: 'etag1' },
          { key: `projects/${projectId2}/studies/s1/file2.pdf`, size: 200, uploaded: new Date(), etag: 'etag2' },
        ],
        truncated: false,
      }),
      get: async () => null,
      put: async () => ({ key: 'test-key' }),
      delete: async () => {},
    };

    const res = await fetchApp('/api/admin/storage/documents?limit=10', {}, { PDF_BUCKET: mockR2 });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.documents.length).toBe(2);
    const doc1 = body.documents.find(d => d.projectId === projectId1);
    const doc2 = body.documents.find(d => d.projectId === projectId2);
    expect(doc1.orphaned).toBe(false);
    expect(doc2.orphaned).toBe(true);
  });
});

describe('Admin storage routes - DELETE /api/admin/storage/documents', () => {
  it('should reject invalid key pattern', async () => {
    const mockR2 = {
      list: async () => ({ objects: [], truncated: false }),
      get: async () => null,
      put: async () => ({ key: 'test-key' }),
      delete: async () => {},
    };

    const res = await fetchApp(
      '/api/admin/storage/documents',
      {
        method: 'DELETE',
        body: JSON.stringify({
          keys: ['invalid-key'],
        }),
      },
      { PDF_BUCKET: mockR2 },
    );

    expect(res.status).toBe(400);
  });

  it('should handle bulk delete with partial failures', async () => {
    const mockR2 = {
      list: async () => ({ objects: [], truncated: false }),
      get: async () => null,
      put: async () => ({ key: 'test-key' }),
      delete: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Delete failed'))
        .mockResolvedValueOnce(undefined),
    };

    const res = await fetchApp(
      '/api/admin/storage/documents',
      {
        method: 'DELETE',
        body: JSON.stringify({
          keys: [
            'projects/p1/studies/s1/file1.pdf',
            'projects/p1/studies/s1/file2.pdf',
            'projects/p1/studies/s1/file3.pdf',
          ],
        }),
      },
      { PDF_BUCKET: mockR2 },
    );

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.deleted).toBe(2);
    expect(body.failed).toBe(1);
    expect(body.errors).toBeDefined();
    expect(body.errors.length).toBe(1);
    expect(body.errors[0].key).toBe('projects/p1/studies/s1/file2.pdf');
  });

  it('should require at least one key', async () => {
    const mockR2 = {
      list: async () => ({ objects: [], truncated: false }),
      get: async () => null,
      put: async () => ({ key: 'test-key' }),
      delete: async () => {},
    };

    const res = await fetchApp(
      '/api/admin/storage/documents',
      {
        method: 'DELETE',
        body: JSON.stringify({
          keys: [],
        }),
      },
      { PDF_BUCKET: mockR2 },
    );

    expect(res.status).toBe(400);
  });
});

describe('Admin storage routes - GET /api/admin/storage/stats', () => {
  it('should return storage statistics', async () => {
    const mockR2 = {
      list: vi.fn()
        .mockResolvedValueOnce({
          objects: [
            { key: 'projects/p1/studies/s1/file1.pdf', size: 100, uploaded: new Date(), etag: 'etag1' },
            { key: 'projects/p1/studies/s1/file2.pdf', size: 200, uploaded: new Date(), etag: 'etag2' },
            { key: 'projects/p2/studies/s1/file3.pdf', size: 300, uploaded: new Date(), etag: 'etag3' },
          ],
          truncated: false,
        }),
      get: async () => null,
      put: async () => ({ key: 'test-key' }),
      delete: async () => {},
    };

    const res = await fetchApp('/api/admin/storage/stats', {}, { PDF_BUCKET: mockR2 });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.totalFiles).toBe(3);
    expect(body.totalSize).toBe(600);
    expect(body.filesByProject).toBeDefined();
    expect(body.filesByProject.length).toBeGreaterThan(0);
  });
});
