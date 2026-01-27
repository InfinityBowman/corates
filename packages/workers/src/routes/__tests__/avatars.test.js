/**
 * Integration tests for avatar routes
 * Tests avatar upload/download/delete with R2 storage
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { resetTestDatabase, json } from '@/__tests__/helpers.js';
import { buildUser, buildProject, resetCounter } from '@/__tests__/factories';

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
let mockProjectDO;

beforeAll(async () => {
  const { avatarRoutes } = await import('../avatars.js');
  app = new Hono();
  app.route('/api/users/avatar', avatarRoutes);
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
    const user = await buildUser();

    const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG header
    const file = new File([imageData], 'avatar.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await fetchAvatar('/api/users/avatar', {
      method: 'POST',
      headers: { 'x-test-user-id': user.id, 'x-test-user-email': user.email },
      body: formData,
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.url).toMatch(new RegExp(`^/api/users/avatar/${user.id}\\?t=\\d+$`));
    expect(body.key).toMatch(new RegExp(`^avatars/${user.id}/\\d+\\.(jpg|jpeg|png|gif|webp)$`));
  });

  it('should reject files that are too large', async () => {
    const user = await buildUser();

    const largeFile = new File([new ArrayBuffer(3 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    });
    const formData = new FormData();
    formData.append('avatar', largeFile);

    const res = await fetchAvatar('/api/users/avatar', {
      method: 'POST',
      headers: {
        'x-test-user-id': user.id,
        'x-test-user-email': user.email,
        'Content-Length': String(3 * 1024 * 1024),
      },
      body: formData,
    });

    expect(res.status).toBe(413);
    const body = await json(res);
    expect(body.code).toBe('FILE_TOO_LARGE');
  });

  it('should reject invalid file types', async () => {
    const user = await buildUser();

    const file = new File(['not an image'], 'document.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await fetchAvatar('/api/users/avatar', {
      method: 'POST',
      headers: { 'x-test-user-id': user.id, 'x-test-user-email': user.email },
      body: formData,
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('FILE_INVALID_TYPE');
  });

  it('should delete old avatar when uploading new one', async () => {
    const user = await buildUser();

    // Upload first avatar
    const imageData1 = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file1 = new File([imageData1], 'avatar1.jpg', { type: 'image/jpeg' });
    const formData1 = new FormData();
    formData1.append('avatar', file1);

    const res1 = await fetchAvatar('/api/users/avatar', {
      method: 'POST',
      headers: { 'x-test-user-id': user.id, 'x-test-user-email': user.email },
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
      headers: { 'x-test-user-id': user.id, 'x-test-user-email': user.email },
      body: formData2,
    });
    expect(res2.status).toBe(200);

    // Check old avatar is deleted from R2
    const oldAvatar = await mockR2Bucket.get(firstKey);
    expect(oldAvatar).toBeNull();

    // Verify new avatar exists in R2
    const body2 = await json(res2);
    const newAvatar = await mockR2Bucket.get(body2.key);
    expect(newAvatar).not.toBeNull();
  });

  it('should sync avatar to project memberships', async () => {
    const { project, owner } = await buildProject();

    // Get the DO stub once and override its fetch
    const projectDO = mockProjectDO.get({ toString: () => `do-${project.id}` });
    const originalFetch = projectDO.fetch;
    const originalGet = mockProjectDO.get;

    projectDO.fetch = async request => {
      const url = new URL(request.url);
      if (url.pathname === '/sync-member') {
        const body = await request.json();
        expect(body.action).toBe('update');
        expect(body.member.userId).toBe(owner.id);
        expect(body.member.image).toMatch(new RegExp(`^/api/users/avatar/${owner.id}\\?t=\\d+$`));
      }
      return originalFetch(request);
    };

    // Make get() return the same stub so the route handler uses our override
    mockProjectDO.get = vi.fn(() => projectDO);

    try {
      const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const file = new File([imageData], 'avatar.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetchAvatar('/api/users/avatar', {
        method: 'POST',
        headers: { 'x-test-user-id': owner.id, 'x-test-user-email': owner.email },
        body: formData,
      });

      expect(res.status).toBe(200);
    } finally {
      // Restore original implementations
      projectDO.fetch = originalFetch;
      mockProjectDO.get = originalGet;
    }
  });
});

describe('Avatar Routes - GET /api/users/avatar/:userId', () => {
  it('should return avatar image', async () => {
    const user = await buildUser();

    // Upload avatar first
    const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    await mockR2Bucket.put(`avatars/${user.id}/1234567890.jpg`, imageData, {
      httpMetadata: { contentType: 'image/jpeg' },
    });

    const res = await fetchAvatar(`/api/users/avatar/${user.id}`, {
      headers: { 'x-test-user-id': user.id, 'x-test-user-email': user.email },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000');
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
  });

  it('should return 404 when avatar not found', async () => {
    const user = await buildUser();

    const res = await fetchAvatar(`/api/users/avatar/${user.id}`, {
      headers: { 'x-test-user-id': user.id, 'x-test-user-email': user.email },
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.code).toBe('FILE_NOT_FOUND');
  });
});

describe('Avatar Routes - DELETE /api/users/avatar', () => {
  it('should delete user avatar', async () => {
    const user = await buildUser();

    // Upload avatar first
    const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    await mockR2Bucket.put(`avatars/${user.id}/1234567890.jpg`, imageData, {
      httpMetadata: { contentType: 'image/jpeg' },
    });

    const res = await fetchAvatar('/api/users/avatar', {
      method: 'DELETE',
      headers: { 'x-test-user-id': user.id, 'x-test-user-email': user.email },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);

    // Verify avatar is deleted from R2
    const listed = await mockR2Bucket.list({ prefix: `avatars/${user.id}/` });
    expect(listed.objects.length).toBe(0);
  });

  it('should handle deletion when no avatar exists', async () => {
    const user = await buildUser();

    const res = await fetchAvatar('/api/users/avatar', {
      method: 'DELETE',
      headers: { 'x-test-user-id': user.id, 'x-test-user-email': user.email },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
  });
});
