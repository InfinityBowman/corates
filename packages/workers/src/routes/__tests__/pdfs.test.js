/**
 * Integration tests for org-scoped PDF routes
 * Tests PDF upload/download/delete with R2 storage and project membership
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { resetTestDatabase, seedMediaFile, json } from '@/__tests__/helpers.js';
import { buildUser, buildProject, buildOrgMember, resetCounter } from '@/__tests__/factories';
import { createDb } from '@/db/client.js';
import { mediaFiles } from '@/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { FILE_SIZE_LIMITS } from '@/config/constants.js';

// Mock postmark
vi.mock('postmark', () => {
  return {
    Client: class {
      constructor() {}
      sendEmail() {
        return Promise.resolve({ Message: 'mock' });
      }
    },
  };
});

// Mock auth middleware
vi.mock('@/middleware/auth.js', () => {
  return {
    requireAuth: async (c, next) => {
      const userId = c.req.raw.headers.get('x-test-user-id') || 'user-1';
      const email = c.req.raw.headers.get('x-test-user-email') || 'user1@example.com';
      c.set('user', {
        id: userId,
        email,
        name: 'Test User',
        givenName: 'Test',
        familyName: 'User',
        image: null,
      });
      c.set('session', { id: 'test-session' });
      await next();
    },
    getAuth: c => ({
      user: c.get('user'),
      session: c.get('session'),
    }),
  };
});

let app;
let mockR2Bucket;

beforeAll(async () => {
  const { orgPdfRoutes } = await import('../orgs/pdfs.js');
  app = new Hono();
  app.route('/api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs', orgPdfRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();

  // Reset R2 mocks
  const storedObjects = new Map();
  mockR2Bucket = {
    list: async ({ prefix }) => {
      const objects = Array.from(storedObjects.entries())
        .filter(([key]) => !prefix || key.startsWith(prefix))
        .map(([key, value]) => ({
          key,
          size: value.size,
          uploaded: value.uploaded,
        }));
      return { objects, truncated: false };
    },
    get: async key => {
      const obj = storedObjects.get(key);
      if (!obj) return null;
      return {
        body: new Response(obj.body).body, // Return ReadableStream
        httpMetadata: obj.httpMetadata,
      };
    },
    put: async (key, body, options) => {
      let arrayBuffer;
      if (body instanceof ArrayBuffer) {
        arrayBuffer = body;
      } else if (body instanceof ReadableStream || typeof body?.getReader === 'function') {
        // Handle ReadableStream
        const reader = body.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        arrayBuffer = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          arrayBuffer.set(chunk, offset);
          offset += chunk.length;
        }
        arrayBuffer = arrayBuffer.buffer;
      } else if (body && typeof body.arrayBuffer === 'function') {
        arrayBuffer = await body.arrayBuffer();
      } else {
        // Fallback: try to convert to ArrayBuffer
        arrayBuffer = new Uint8Array(body).buffer;
      }
      storedObjects.set(key, {
        body: arrayBuffer,
        size: arrayBuffer.byteLength,
        uploaded: Date.now(),
        httpMetadata: options?.httpMetadata || {},
        customMetadata: options?.customMetadata || {},
      });
      return { key };
    },
    delete: async key => {
      storedObjects.delete(key);
    },
    head: async key => {
      return storedObjects.has(key) ? { key } : null;
    },
  };

  // Override env bindings
  env.PDF_BUCKET = mockR2Bucket;
});

async function fetchPdf(orgId, projectId, studyId, path = '', init = {}) {
  const ctx = createExecutionContext();
  // Route is mounted at /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs
  // For list endpoint, path should be empty or '/'
  const routePath = path === 's' ? '' : path;
  const req = new Request(
    `http://localhost/api/orgs/${orgId}/projects/${projectId}/studies/${studyId}/pdfs${routePath}`,
    {
      ...init,
      headers: {
        'x-test-user-id': 'user-1',
        'x-test-user-email': 'user1@example.com',
        ...init.headers,
      },
    },
  );
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe('Org-Scoped PDF Routes - GET /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs', () => {
  it('should list PDFs for a study', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const { project, org, owner } = await buildProject();

    // Seed a PDF in mediaFiles table
    await seedMediaFile({
      id: 'media-1',
      filename: 'document.pdf',
      originalName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      uploadedBy: owner.id,
      bucketKey: `projects/${project.id}/studies/study-1/document.pdf`,
      orgId: org.id,
      projectId: project.id,
      studyId: 'study-1',
      createdAt: nowSec,
    });

    // Also add to R2 mock for download compatibility
    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    await mockR2Bucket.put(`projects/${project.id}/studies/study-1/document.pdf`, pdfData, {
      httpMetadata: { contentType: 'application/pdf' },
    });

    const res = await fetchPdf(org.id, project.id, 'study-1', 's', {
      headers: { 'x-test-user-id': owner.id, 'x-test-user-email': owner.email },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.pdfs).toBeDefined();
    expect(body.pdfs.length).toBe(1);
    expect(body.pdfs[0].fileName).toBe('document.pdf');
    expect(body.pdfs[0].id).toBe('media-1');
    expect(body.pdfs[0].uploadedBy).toBeDefined();
    expect(body.pdfs[0].uploadedBy.id).toBe(owner.id);
  });

  it('should require project membership', async () => {
    // Create a project with owner
    const { project, org } = await buildProject();

    // Create user1 who is an org member but NOT a project member
    const nonMember = await buildUser({ email: 'nonmember@example.com' });
    await buildOrgMember({ orgId: org.id, user: nonMember, role: 'member' });

    const res = await fetchPdf(org.id, project.id, 'study-1', 's', {
      headers: { 'x-test-user-id': nonMember.id, 'x-test-user-email': nonMember.email },
    });

    // Route returns 403 for access denied (when user is not a project member)
    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('PROJECT_ACCESS_DENIED');
  });
});

describe('Org-Scoped PDF Routes - POST /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs', () => {
  it('should upload PDF successfully', async () => {
    const { project, org, owner } = await buildProject();

    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    const file = new File([pdfData], 'document.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetchPdf(org.id, project.id, 'study-1', '', {
      method: 'POST',
      headers: { 'x-test-user-id': owner.id, 'x-test-user-email': owner.email },
      body: formData,
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.fileName).toBe('document.pdf');
    expect(body.key).toBe(`projects/${project.id}/studies/study-1/document.pdf`);
    expect(body.id).toBeDefined();

    // Verify mediaFiles record was created
    const db = createDb(env.DB);
    const mediaFile = await db
      .select()
      .from(mediaFiles)
      .where(
        and(
          eq(mediaFiles.projectId, project.id),
          eq(mediaFiles.studyId, 'study-1'),
          eq(mediaFiles.filename, 'document.pdf'),
        ),
      )
      .get();
    expect(mediaFile).toBeDefined();
    expect(mediaFile.id).toBe(body.id);
    expect(mediaFile.orgId).toBe(org.id);
    expect(mediaFile.projectId).toBe(project.id);
    expect(mediaFile.studyId).toBe('study-1');
    expect(mediaFile.uploadedBy).toBe(owner.id);
  });

  it('should reject files that are too large', async () => {
    const { project, org, owner } = await buildProject();

    const largeFile = new File([new ArrayBuffer(FILE_SIZE_LIMITS.PDF + 1)], 'large.pdf', {
      type: 'application/pdf',
    });
    const formData = new FormData();
    formData.append('file', largeFile);

    const res = await fetchPdf(org.id, project.id, 'study-1', '', {
      method: 'POST',
      headers: {
        'x-test-user-id': owner.id,
        'x-test-user-email': owner.email,
        'Content-Length': String(FILE_SIZE_LIMITS.PDF + 1),
      },
      body: formData,
    });

    expect(res.status).toBe(413);
    const body = await json(res);
    expect(body.code).toBe('FILE_TOO_LARGE');
  });

  it('should reject non-PDF files', async () => {
    const { project, org, owner } = await buildProject();

    const file = new File(['not a pdf'], 'document.txt', { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetchPdf(org.id, project.id, 'study-1', '', {
      method: 'POST',
      headers: { 'x-test-user-id': owner.id, 'x-test-user-email': owner.email },
      body: formData,
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('VALIDATION_FIELD_INVALID_FORMAT');
  });

  it('should auto-rename duplicate file names', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const { project, org, owner } = await buildProject();

    // Seed first PDF in database
    await seedMediaFile({
      id: 'media-1',
      filename: 'document.pdf',
      originalName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      uploadedBy: owner.id,
      bucketKey: `projects/${project.id}/studies/study-1/document.pdf`,
      orgId: org.id,
      projectId: project.id,
      studyId: 'study-1',
      createdAt: nowSec,
    });

    // Also add to R2 mock
    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    await mockR2Bucket.put(`projects/${project.id}/studies/study-1/document.pdf`, pdfData, {
      httpMetadata: { contentType: 'application/pdf' },
    });

    // Try to upload duplicate - should auto-rename
    const file = new File([pdfData], 'document.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetchPdf(org.id, project.id, 'study-1', '', {
      method: 'POST',
      headers: { 'x-test-user-id': owner.id, 'x-test-user-email': owner.email },
      body: formData,
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.fileName).toBe('document (1).pdf');
    expect(body.originalFileName).toBe('document.pdf');
    expect(body.key).toBe(`projects/${project.id}/studies/study-1/document (1).pdf`);
  });

  it('should accept raw PDF upload with X-File-Name header', async () => {
    const { project, org, owner } = await buildProject();

    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

    const res = await fetchPdf(org.id, project.id, 'study-1', '', {
      method: 'POST',
      headers: {
        'x-test-user-id': owner.id,
        'x-test-user-email': owner.email,
        'Content-Type': 'application/pdf',
        'X-File-Name': 'raw-document.pdf',
      },
      body: pdfData,
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.fileName).toBe('raw-document.pdf');
  });
});

describe('Org-Scoped PDF Routes - GET /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs/:fileName', () => {
  it('should download PDF successfully', async () => {
    const { project, org, owner } = await buildProject();

    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    await mockR2Bucket.put(`projects/${project.id}/studies/study-1/document.pdf`, pdfData, {
      httpMetadata: { contentType: 'application/pdf' },
    });

    const res = await fetchPdf(org.id, project.id, 'study-1', '/document.pdf', {
      headers: { 'x-test-user-id': owner.id, 'x-test-user-email': owner.email },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('document.pdf');
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBe(5);
  });

  it('should return 404 when PDF not found', async () => {
    const { project, org, owner } = await buildProject();

    const res = await fetchPdf(org.id, project.id, 'study-1', '/nonexistent.pdf', {
      headers: { 'x-test-user-id': owner.id, 'x-test-user-email': owner.email },
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.code).toBe('FILE_NOT_FOUND');
  });
});

describe('Org-Scoped PDF Routes - DELETE /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs/:fileName', () => {
  it('should delete PDF successfully', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const { project, org, owner } = await buildProject();

    // Seed a PDF in mediaFiles table
    await seedMediaFile({
      id: 'media-1',
      filename: 'document.pdf',
      originalName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      uploadedBy: owner.id,
      bucketKey: `projects/${project.id}/studies/study-1/document.pdf`,
      orgId: org.id,
      projectId: project.id,
      studyId: 'study-1',
      createdAt: nowSec,
    });

    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    await mockR2Bucket.put(`projects/${project.id}/studies/study-1/document.pdf`, pdfData, {
      httpMetadata: { contentType: 'application/pdf' },
    });

    const res = await fetchPdf(org.id, project.id, 'study-1', '/document.pdf', {
      method: 'DELETE',
      headers: { 'x-test-user-id': owner.id, 'x-test-user-email': owner.email },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);

    // Verify mediaFiles record was deleted
    const db = createDb(env.DB);
    const mediaFile = await db
      .select()
      .from(mediaFiles)
      .where(
        and(
          eq(mediaFiles.projectId, project.id),
          eq(mediaFiles.studyId, 'study-1'),
          eq(mediaFiles.filename, 'document.pdf'),
        ),
      )
      .get();
    expect(mediaFile).toBeUndefined();

    // Verify PDF is deleted
    const pdf = await mockR2Bucket.get(`projects/${project.id}/studies/study-1/document.pdf`);
    expect(pdf).toBeNull();
  });
});
