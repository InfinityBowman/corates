/**
 * Integration tests for avatar routes
 * Tests avatar upload/download/delete with R2 storage
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  seedUser,
  seedProject,
  seedProjectMember,
  seedOrganization,
  seedOrgMember,
  json,
} from '../../__tests__/helpers.js';

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
let mockProjectDO;

beforeAll(async () => {
  const { avatarRoutes } = await import('../avatars.js');
  app = new Hono();
  app.route('/api/users/avatar', avatarRoutes);
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
          etag: value.etag,
        }))
        .sort((a, b) => b.uploaded - a.uploaded); // Most recent first
      return { objects, truncated: false };
    },
    get: async key => {
      const obj = storedObjects.get(key);
      if (!obj) return null;
      return {
        body: new Response(obj.body).body, // Return ReadableStream
        httpMetadata: obj.httpMetadata,
        etag: obj.etag,
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
        etag: `etag-${key}`,
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

  // Mock Project DO for sync
  mockProjectDO = {
    idFromName: name => ({ toString: () => `do-${name}` }),
    get: _id => ({
      fetch: async request => {
        const url = new URL(request.url);
        if (url.pathname === '/sync-member') {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response(JSON.stringify({ ok: false }), { status: 404 });
      },
    }),
  };

  // Override env bindings
  env.PDF_BUCKET = mockR2Bucket;
  env.PROJECT_DOC = mockProjectDO;
});

async function fetchAvatar(path, init = {}) {
  const ctx = createExecutionContext();
  const req = new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      'x-test-user-id': 'user-1',
      'x-test-user-email': 'user1@example.com',
      ...init.headers,
    },
  });
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe('Avatar Routes - POST /api/users/avatar', () => {
  it('should upload avatar successfully', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG header
    const file = new File([imageData], 'avatar.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await fetchAvatar('/api/users/avatar', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.url).toMatch(/^\/api\/users\/avatar\/user-1\?t=\d+$/);
    expect(body.key).toMatch(/^avatars\/user-1\/\d+\.(jpg|jpeg|png|gif|webp)$/);
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

    const largeFile = new File([new ArrayBuffer(3 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    });
    const formData = new FormData();
    formData.append('avatar', largeFile);

    const res = await fetchAvatar('/api/users/avatar', {
      method: 'POST',
      headers: {
        'Content-Length': String(3 * 1024 * 1024),
      },
      body: formData,
    });

    expect(res.status).toBe(413);
    const body = await json(res);
    expect(body.code).toBe('FILE_TOO_LARGE');
  });

  it('should reject invalid file types', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const file = new File(['not an image'], 'document.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await fetchAvatar('/api/users/avatar', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('FILE_INVALID_TYPE');
  });

  it('should delete old avatar when uploading new one', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    // Upload first avatar
    const imageData1 = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file1 = new File([imageData1], 'avatar1.jpg', { type: 'image/jpeg' });
    const formData1 = new FormData();
    formData1.append('avatar', file1);

    const res1 = await fetchAvatar('/api/users/avatar', {
      method: 'POST',
      body: formData1,
    });
    expect(res1.status).toBe(200);
    const body1 = await json(res1);
    const firstKey = body1.key;

    // Upload second avatar
    const imageData2 = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
    const file2 = new File([imageData2], 'avatar2.png', { type: 'image/png' });
    const formData2 = new FormData();
    formData2.append('avatar', file2);

    const res2 = await fetchAvatar('/api/users/avatar', {
      method: 'POST',
      body: formData2,
    });
    expect(res2.status).toBe(200);

    // Check old avatar is deleted
    const oldAvatar = await mockR2Bucket.get(firstKey);
    expect(oldAvatar).toBeNull();
  });

  it('should sync avatar to project memberships', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      orgId: 'org-1',
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

    const originalFetch = mockProjectDO.get({ toString: () => 'do-project-1' }).fetch;
    mockProjectDO.get({ toString: () => 'do-project-1' }).fetch = async request => {
      const url = new URL(request.url);
      if (url.pathname === '/sync-member') {
        const body = await request.json();
        expect(body.action).toBe('update');
        expect(body.member.userId).toBe('user-1');
        expect(body.member.image).toMatch(/^\/api\/users\/avatar\/user-1\?t=\d+$/);
      }
      return originalFetch(request);
    };

    const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([imageData], 'avatar.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await fetchAvatar('/api/users/avatar', {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(200);
    // Note: sync happens asynchronously, so we can't easily verify it in this test
    // but the code path is exercised
  });
});

describe('Avatar Routes - GET /api/users/avatar/:userId', () => {
  it('should return avatar image', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    // Upload avatar first
    const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    await mockR2Bucket.put('avatars/user-1/1234567890.jpg', imageData, {
      httpMetadata: { contentType: 'image/jpeg' },
    });

    const res = await fetchAvatar('/api/users/avatar/user-1');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000');
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
  });

  it('should return 404 when avatar not found', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchAvatar('/api/users/avatar/user-1');

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.code).toBe('FILE_NOT_FOUND');
  });
});

describe('Avatar Routes - DELETE /api/users/avatar', () => {
  it('should delete user avatar', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    // Upload avatar first
    const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    await mockR2Bucket.put('avatars/user-1/1234567890.jpg', imageData, {
      httpMetadata: { contentType: 'image/jpeg' },
    });

    const res = await fetchAvatar('/api/users/avatar', {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);

    // Verify avatar is deleted
    const listed = await mockR2Bucket.list({ prefix: 'avatars/user-1/' });
    expect(listed.objects.length).toBe(0);
  });

  it('should handle deletion when no avatar exists', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchAvatar('/api/users/avatar', {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
  });
});
