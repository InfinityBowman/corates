/**
 * Integration tests for PDF routes
 * Tests PDF upload/download/delete with R2 storage and project membership
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  seedUser,
  seedProject,
  seedProjectMember,
  json,
} from '../../__tests__/helpers.js';
import { FILE_SIZE_LIMITS } from '../../config/constants.js';

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
vi.mock('../../middleware/auth.js', () => {
  return {
    requireAuth: async (c, next) => {
      const userId = c.req.raw.headers.get('x-test-user-id') || 'user-1';
      const email = c.req.raw.headers.get('x-test-user-email') || 'user1@example.com';
      c.set('user', {
        id: userId,
        email,
        name: 'Test User',
        displayName: 'Test User',
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
  const { pdfRoutes } = await import('../pdfs.js');
  app = new Hono();
  app.route('/api/projects/:projectId/studies/:studyId/pdf', pdfRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();

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

async function fetchPdf(projectId, studyId, path = '', init = {}) {
  const ctx = createExecutionContext();
  // Route is mounted at /api/projects/:projectId/studies/:studyId/pdf
  // For list endpoint, path should be empty or '/'
  const routePath = path === 's' ? '' : path;
  const req = new Request(
    `http://localhost/api/projects/${projectId}/studies/${studyId}/pdf${routePath}`,
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

describe('PDF Routes - GET /api/projects/:projectId/studies/:studyId/pdfs', () => {
  it('should list PDFs for a study', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    // Upload a PDF
    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    await mockR2Bucket.put('projects/project-1/studies/study-1/document.pdf', pdfData, {
      httpMetadata: { contentType: 'application/pdf' },
    });

    const res = await fetchPdf('project-1', 'study-1', 's');

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.pdfs).toBeDefined();
    expect(body.pdfs.length).toBe(1);
    expect(body.pdfs[0].fileName).toBe('document.pdf');
  });

  it('should require project membership', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      createdBy: 'user-2',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchPdf('project-1', 'study-1', 's');

    // Route returns 403 for access denied (when user is not a member)
    expect([403, 404]).toContain(res.status);
    if (res.status === 403) {
      const body = await json(res);
      expect(body.code).toBe('PROJECT_ACCESS_DENIED');
    }
  });
});

describe('PDF Routes - POST /api/projects/:projectId/studies/:studyId/pdf', () => {
  it('should upload PDF successfully', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    const file = new File([pdfData], 'document.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetchPdf('project-1', 'study-1', '', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.fileName).toBe('document.pdf');
    expect(body.key).toBe('projects/project-1/studies/study-1/document.pdf');
  });

  it('should reject files that are too large', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    const largeFile = new File([new ArrayBuffer(FILE_SIZE_LIMITS.PDF + 1)], 'large.pdf', {
      type: 'application/pdf',
    });
    const formData = new FormData();
    formData.append('file', largeFile);

    const res = await fetchPdf('project-1', 'study-1', '', {
      method: 'POST',
      headers: {
        'Content-Length': String(FILE_SIZE_LIMITS.PDF + 1),
      },
      body: formData,
    });

    expect(res.status).toBe(413);
    const body = await json(res);
    expect(body.code).toBe('FILE_TOO_LARGE');
  });

  it('should reject non-PDF files', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    const file = new File(['not a pdf'], 'document.txt', { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetchPdf('project-1', 'study-1', '', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('FILE_INVALID_TYPE');
  });

  it('should reject duplicate file names', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    // Upload first PDF
    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    await mockR2Bucket.put('projects/project-1/studies/study-1/document.pdf', pdfData, {
      httpMetadata: { contentType: 'application/pdf' },
    });

    // Try to upload duplicate
    const file = new File([pdfData], 'document.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetchPdf('project-1', 'study-1', '', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.code).toBe('FILE_ALREADY_EXISTS');
  });

  it('should block viewers from uploading', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      createdBy: 'user-2',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'viewer',
      joinedAt: nowSec,
    });

    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const file = new File([pdfData], 'document.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetchPdf('project-1', 'study-1', '', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
  });

  it('should accept raw PDF upload with X-File-Name header', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

    const res = await fetchPdf('project-1', 'study-1', '', {
      method: 'POST',
      headers: {
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

describe('PDF Routes - GET /api/projects/:projectId/studies/:studyId/pdf/:fileName', () => {
  it('should download PDF successfully', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    await mockR2Bucket.put('projects/project-1/studies/study-1/document.pdf', pdfData, {
      httpMetadata: { contentType: 'application/pdf' },
    });

    const res = await fetchPdf('project-1', 'study-1', '/document.pdf');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('document.pdf');
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBe(5);
  });

  it('should return 404 when PDF not found', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    const res = await fetchPdf('project-1', 'study-1', '/nonexistent.pdf');

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.code).toBe('FILE_NOT_FOUND');
  });
});

describe('PDF Routes - DELETE /api/projects/:projectId/studies/:studyId/pdf/:fileName', () => {
  it('should delete PDF successfully', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    await mockR2Bucket.put('projects/project-1/studies/study-1/document.pdf', pdfData, {
      httpMetadata: { contentType: 'application/pdf' },
    });

    const res = await fetchPdf('project-1', 'study-1', '/document.pdf', {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);

    // Verify PDF is deleted
    const pdf = await mockR2Bucket.get('projects/project-1/studies/study-1/document.pdf');
    expect(pdf).toBeNull();
  });

  it('should block viewers from deleting', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      createdBy: 'user-2',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'viewer',
      joinedAt: nowSec,
    });

    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    await mockR2Bucket.put('projects/project-1/studies/study-1/document.pdf', pdfData, {
      httpMetadata: { contentType: 'application/pdf' },
    });

    const res = await fetchPdf('project-1', 'study-1', '/document.pdf', {
      method: 'DELETE',
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
  });
});
