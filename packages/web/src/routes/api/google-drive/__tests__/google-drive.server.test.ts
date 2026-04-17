import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildUser, buildProject, resetCounter } from '@/__tests__/server/factories';
import { handler as statusHandler } from '../status';
import { handler as pickerTokenHandler } from '../picker-token';
import { handler as disconnectHandler } from '../disconnect';
import { handler as importHandler } from '../import';

let currentUser: { id: string; email: string } = { id: 'user-1', email: 'user1@example.com' };

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => ({
    user: { id: currentUser.id, email: currentUser.email, name: 'Test User' },
    session: { id: 'test-session', userId: currentUser.id },
  }),
}));

const originalFetch = globalThis.fetch;
let mockFetch: Mock;

async function clearR2(prefix: string) {
  const listed = await env.PDF_BUCKET.list({ prefix });
  for (const obj of listed.objects) {
    await env.PDF_BUCKET.delete(obj.key);
  }
}

async function seedGoogleAccount(
  userId: string,
  accessToken = 'token-123',
  refreshToken = 'refresh-123',
) {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = new Date(Date.now() + 3600 * 1000);

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

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  await clearProjectDOs(['project-1']);
  await clearR2('projects/');
  currentUser = { id: 'user-1', email: 'user1@example.com' };

  (env as unknown as Record<string, string>).GOOGLE_CLIENT_ID = 'test-client-id';
  (env as unknown as Record<string, string>).GOOGLE_CLIENT_SECRET = 'test-client-secret';

  mockFetch = vi.fn();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function req(path: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost${path}`, init);
}

describe('GET /api/google-drive/status', () => {
  it('returns connected status when Google account is linked', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    await seedGoogleAccount(user.id);
    currentUser = { id: user.id, email: user.email };

    const res = await statusHandler({ request: req('/api/google-drive/status') });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { connected: boolean; hasRefreshToken: boolean };
    expect(body.connected).toBe(true);
    expect(body.hasRefreshToken).toBe(true);
  });

  it('returns disconnected status when Google account is not linked', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    currentUser = { id: user.id, email: user.email };

    const res = await statusHandler({ request: req('/api/google-drive/status') });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { connected: boolean; hasRefreshToken: boolean };
    expect(body.connected).toBe(false);
    expect(body.hasRefreshToken).toBe(false);
  });
});

describe('GET /api/google-drive/picker-token', () => {
  it('returns access token when connected', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    await seedGoogleAccount(user.id, 'token-123', 'refresh-123');
    currentUser = { id: user.id, email: user.email };

    const res = await pickerTokenHandler({ request: req('/api/google-drive/picker-token') });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { accessToken: string; expiresAt: string };
    expect(body.accessToken).toBe('token-123');
    expect(body.expiresAt).toBeDefined();
  });

  it('returns 401 when Google account is not connected', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    currentUser = { id: user.id, email: user.email };

    const res = await pickerTokenHandler({ request: req('/api/google-drive/picker-token') });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('AUTH_INVALID');
  });

  it('refreshes expired token', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const user = await buildUser({ email: 'user1@example.com' });
    currentUser = { id: user.id, email: user.email };

    const expiredAt = new Date(Date.now() - 1000);
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

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'new-token-456', expires_in: 3600 }),
    } as unknown as Response);

    const res = await pickerTokenHandler({ request: req('/api/google-drive/picker-token') });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { accessToken: string };
    expect(body.accessToken).toBe('new-token-456');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('oauth2.googleapis.com/token'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('DELETE /api/google-drive/disconnect', () => {
  it('disconnects Google account', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    await seedGoogleAccount(user.id);
    currentUser = { id: user.id, email: user.email };

    const res = await disconnectHandler({
      request: req('/api/google-drive/disconnect', { method: 'DELETE' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    const acct = await env.DB.prepare(
      'SELECT * FROM account WHERE userId = ?1 AND providerId = ?2',
    )
      .bind(user.id, 'google')
      .first();
    expect(acct).toBeNull();
  });
});

function importReq(body: unknown): Request {
  return req('/api/google-drive/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/google-drive/import', () => {
  it('imports PDF from Google Drive', async () => {
    const { project, owner } = await buildProject();
    await seedGoogleAccount(owner.id);
    currentUser = { id: owner.id, email: owner.email };

    const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'file-123',
            name: 'document.pdf',
            mimeType: 'application/pdf',
            size: '1024',
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(pdfData.buffer as ArrayBuffer, {
          headers: { 'Content-Type': 'application/pdf' },
        }),
      );

    const res = await importHandler({
      request: importReq({ fileId: 'file-123', projectId: project.id, studyId: 'study-1' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      file: { fileName: string; source: string };
    };
    expect(body.success).toBe(true);
    expect(body.file.fileName).toBe('document.pdf');
    expect(body.file.source).toBe('google-drive');
  });

  it('rejects non-PDF files', async () => {
    const { project, owner } = await buildProject();
    await seedGoogleAccount(owner.id);
    currentUser = { id: owner.id, email: owner.email };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'file-123',
        name: 'document.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: '1024',
      }),
    } as unknown as Response);

    const res = await importHandler({
      request: importReq({ fileId: 'file-123', projectId: project.id, studyId: 'study-1' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('FILE_INVALID_TYPE');
  });

  it('rejects files that are too large', async () => {
    const { project, owner } = await buildProject();
    await seedGoogleAccount(owner.id);
    currentUser = { id: owner.id, email: owner.email };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'file-123',
        name: 'document.pdf',
        mimeType: 'application/pdf',
        size: String(60 * 1024 * 1024),
      }),
    } as unknown as Response);

    const res = await importHandler({
      request: importReq({ fileId: 'file-123', projectId: project.id, studyId: 'study-1' }),
    });

    expect(res.status).toBe(413);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('FILE_TOO_LARGE');
  });

  it('returns 401 when Google account is not connected', async () => {
    const { project, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await importHandler({
      request: importReq({ fileId: 'file-123', projectId: project.id, studyId: 'study-1' }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('AUTH_INVALID');
  });

  it('validates required fields', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    await seedGoogleAccount(user.id);
    currentUser = { id: user.id, email: user.email };

    const res = await importHandler({
      request: importReq({ fileId: 'file-123' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('VALIDATION_FIELD_REQUIRED');
  });
});
