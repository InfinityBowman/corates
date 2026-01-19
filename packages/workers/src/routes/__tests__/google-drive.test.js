/**
 * Integration tests for Google Drive routes
 * Tests Google Drive integration (status, picker-token, disconnect, import)
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
let mockFetch;

beforeAll(async () => {
  const { googleDriveRoutes } = await import('../google-drive.js');
  app = new Hono();
  app.route('/api/google-drive', googleDriveRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();

  // Reset R2 mocks
  const storedObjects = new Map();
  mockR2Bucket = {
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
        httpMetadata: options?.httpMetadata || {},
        customMetadata: options?.customMetadata || {},
      });
      return { key };
    },
  };

  // Mock fetch for Google API calls
  mockFetch = vi.fn();
  global.fetch = mockFetch;

  // Override env bindings
  env.PDF_BUCKET = mockR2Bucket;
  env.GOOGLE_CLIENT_ID = 'test-client-id';
  env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
});

async function fetchGoogleDrive(path, init = {}) {
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

async function seedGoogleAccount(userId, accessToken = 'token-123', refreshToken = 'refresh-123') {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now

  await env.DB.prepare(
    `INSERT INTO account (id, userId, accountId, providerId, accessToken, refreshToken, accessTokenExpiresAt, createdAt, updatedAt)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
  )
    .bind(
      `acc-${userId}`,
      userId,
      `google-${userId}`,
      'google',
      accessToken,
      refreshToken,
      Math.floor(expiresAt.getTime() / 1000),
      nowSec,
      nowSec,
    )
    .run();
}

describe('Google Drive Routes - GET /api/google-drive/status', () => {
  it('should return connected status when Google account is linked', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    await seedGoogleAccount(user.id);

    const res = await fetchGoogleDrive('/api/google-drive/status', {
      headers: { 'x-test-user-id': user.id, 'x-test-user-email': user.email },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.connected).toBe(true);
    expect(body.hasRefreshToken).toBe(true);
  });

  it('should return disconnected status when Google account is not linked', async () => {
    const user = await buildUser({ email: 'user1@example.com' });

    const res = await fetchGoogleDrive('/api/google-drive/status', {
      headers: { 'x-test-user-id': user.id, 'x-test-user-email': user.email },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.connected).toBe(false);
    expect(body.hasRefreshToken).toBe(false);
  });
});

describe('Google Drive Routes - GET /api/google-drive/picker-token', () => {
  it('should return access token when Google account is connected', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    await seedGoogleAccount(user.id, 'token-123', 'refresh-123');

    const res = await fetchGoogleDrive('/api/google-drive/picker-token', {
      headers: { 'x-test-user-id': user.id, 'x-test-user-email': user.email },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.accessToken).toBe('token-123');
    expect(body.expiresAt).toBeDefined();
  });

  it('should return 401 when Google account is not connected', async () => {
    const user = await buildUser({ email: 'user1@example.com' });

    const res = await fetchGoogleDrive('/api/google-drive/picker-token', {
      headers: { 'x-test-user-id': user.id, 'x-test-user-email': user.email },
    });

    expect(res.status).toBe(401);
    const body = await json(res);
    expect(body.code).toBe('AUTH_INVALID');
  });

  it('should refresh expired token', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const user = await buildUser({ email: 'user1@example.com' });

    // Create account with expired token
    const expiredAt = new Date(Date.now() - 1000); // 1 second ago
    await env.DB.prepare(
      `INSERT INTO account (id, userId, accountId, providerId, accessToken, refreshToken, accessTokenExpiresAt, createdAt, updatedAt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
      .bind(
        `acc-${user.id}`,
        user.id,
        `google-${user.id}`,
        'google',
        'expired-token',
        'refresh-123',
        Math.floor(expiredAt.getTime() / 1000),
        nowSec,
        nowSec,
      )
      .run();

    // Mock token refresh
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new-token-456',
        expires_in: 3600,
      }),
    });

    const res = await fetchGoogleDrive('/api/google-drive/picker-token', {
      headers: { 'x-test-user-id': user.id, 'x-test-user-email': user.email },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.accessToken).toBe('new-token-456');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('oauth2.googleapis.com/token'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});

describe('Google Drive Routes - DELETE /api/google-drive/disconnect', () => {
  it('should disconnect Google account', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    await seedGoogleAccount(user.id);

    const res = await fetchGoogleDrive('/api/google-drive/disconnect', {
      method: 'DELETE',
      headers: { 'x-test-user-id': user.id, 'x-test-user-email': user.email },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);

    // Verify account is deleted
    const account = await env.DB.prepare(
      'SELECT * FROM account WHERE userId = ?1 AND providerId = ?2',
    )
      .bind(user.id, 'google')
      .first();
    expect(account).toBeNull();
  });
});

describe('Google Drive Routes - POST /api/google-drive/import', () => {
  it('should import PDF from Google Drive', async () => {
    const { project, owner } = await buildProject();
    await seedGoogleAccount(owner.id);

    // Mock Google Drive API calls
    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'file-123',
            name: 'document.pdf',
            mimeType: 'application/pdf',
            size: '1024',
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(pdfData.buffer, {
          headers: { 'Content-Type': 'application/pdf' },
        }),
      );

    const res = await fetchGoogleDrive('/api/google-drive/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': owner.id,
        'x-test-user-email': owner.email,
      },
      body: JSON.stringify({
        fileId: 'file-123',
        projectId: project.id,
        studyId: 'study-1',
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.file.fileName).toBe('document.pdf');
    expect(body.file.source).toBe('google-drive');
  });

  it('should reject non-PDF files', async () => {
    const { project, owner } = await buildProject();
    await seedGoogleAccount(owner.id);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'file-123',
        name: 'document.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: '1024',
      }),
    });

    const res = await fetchGoogleDrive('/api/google-drive/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': owner.id,
        'x-test-user-email': owner.email,
      },
      body: JSON.stringify({
        fileId: 'file-123',
        projectId: project.id,
        studyId: 'study-1',
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('FILE_INVALID_TYPE');
  });

  it('should reject files that are too large', async () => {
    const { project, owner } = await buildProject();
    await seedGoogleAccount(owner.id);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'file-123',
        name: 'document.pdf',
        mimeType: 'application/pdf',
        size: String(60 * 1024 * 1024), // 60MB
      }),
    });

    const res = await fetchGoogleDrive('/api/google-drive/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': owner.id,
        'x-test-user-email': owner.email,
      },
      body: JSON.stringify({
        fileId: 'file-123',
        projectId: project.id,
        studyId: 'study-1',
      }),
    });

    expect(res.status).toBe(413);
    const body = await json(res);
    expect(body.code).toBe('FILE_TOO_LARGE');
  });

  it('should return 401 when Google account is not connected', async () => {
    const { project, owner } = await buildProject();
    // Note: No Google account seeded

    const res = await fetchGoogleDrive('/api/google-drive/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': owner.id,
        'x-test-user-email': owner.email,
      },
      body: JSON.stringify({
        fileId: 'file-123',
        projectId: project.id,
        studyId: 'study-1',
      }),
    });

    expect(res.status).toBe(401);
    const body = await json(res);
    expect(body.code).toBe('AUTH_INVALID');
  });

  it('should validate required fields', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    await seedGoogleAccount(user.id);

    const res = await fetchGoogleDrive('/api/google-drive/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': user.id,
        'x-test-user-email': user.email,
      },
      body: JSON.stringify({
        fileId: 'file-123',
        // Missing projectId and studyId
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('VALIDATION_FIELD_REQUIRED');
  });
});
