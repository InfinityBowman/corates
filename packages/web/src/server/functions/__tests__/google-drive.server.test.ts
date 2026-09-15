import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { buildUser, buildProject, resetCounter } from '@/__tests__/server/factories';
import {
  getStatus,
  disconnectGoogle,
  getPickerToken,
  importFromDrive,
} from '@/server/functions/google-drive.server';
import type { Session } from '@/server/middleware/auth';
import { DomainErrorException } from '@corates/shared';

// A real 50MB body is too heavy for the test isolate; shrink the limit instead
vi.mock('@corates/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@corates/shared')>();
  return { ...actual, PDF_LIMITS: { ...actual.PDF_LIMITS, MAX_SIZE: 16 } };
});

let currentUser: { id: string; email: string } = { id: 'user-1', email: 'user1@example.com' };

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
  scope = 'openid email profile https://www.googleapis.com/auth/drive.file',
) {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = new Date(Date.now() + 3600 * 1000);

  await env.DB.prepare(
    `INSERT INTO account (id, userId, accountId, providerId, issuer, accessToken, refreshToken, accessTokenExpiresAt, scope, createdAt, updatedAt)
     VALUES (?1, ?2, ?3, ?4, 'https://accounts.google.com', ?5, ?6, ?7, ?8, ?9, ?10)`,
  )
    .bind(
      `acc-${userId}`,
      userId,
      `google-${userId}`,
      'google',
      accessToken,
      refreshToken,
      Math.floor(expiresAt.getTime() / 1000),
      scope,
      nowSec,
      nowSec,
    )
    .run();
}

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
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

function mockSession(): Session {
  return {
    user: { id: currentUser.id, email: currentUser.email, name: 'Test User' },
    session: { id: 'test-session', userId: currentUser.id },
  } as Session;
}

describe('getStatus', () => {
  it('returns connected status when Google account is linked', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    await seedGoogleAccount(user.id);
    currentUser = { id: user.id, email: user.email };

    const result = await getStatus(createDb(env.DB), mockSession());
    expect(result.connected).toBe(true);
    expect(result.hasRefreshToken).toBe(true);
  });

  it('reports disconnected for accounts that only granted the legacy drive.readonly scope', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    await seedGoogleAccount(
      user.id,
      'token-123',
      'refresh-123',
      'openid email profile https://www.googleapis.com/auth/drive.readonly',
    );
    currentUser = { id: user.id, email: user.email };

    const result = await getStatus(createDb(env.DB), mockSession());
    expect(result.connected).toBe(false);
  });

  it('stays connected when drive.file sits alongside the legacy drive.readonly scope', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    await seedGoogleAccount(
      user.id,
      'token-123',
      'refresh-123',
      'openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
    );
    currentUser = { id: user.id, email: user.email };

    const result = await getStatus(createDb(env.DB), mockSession());
    expect(result.connected).toBe(true);
  });

  it('returns disconnected status when the account lacks the Drive scope', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    await seedGoogleAccount(user.id, 'token-123', 'refresh-123', 'openid email profile');
    currentUser = { id: user.id, email: user.email };

    const result = await getStatus(createDb(env.DB), mockSession());
    expect(result.connected).toBe(false);
  });

  it('returns disconnected status when Google account is not linked', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    currentUser = { id: user.id, email: user.email };

    const result = await getStatus(createDb(env.DB), mockSession());
    expect(result.connected).toBe(false);
    expect(result.hasRefreshToken).toBe(false);
  });
});

describe('getPickerToken', () => {
  it('returns access token when connected', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    await seedGoogleAccount(user.id, 'token-123', 'refresh-123');
    currentUser = { id: user.id, email: user.email };

    const result = await getPickerToken(createDb(env.DB), mockSession());
    expect(result.accessToken).toBe('token-123');
    expect(result.expiresAt).toBeDefined();
  });

  it('throws 401 when Google account is not connected', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    currentUser = { id: user.id, email: user.email };

    try {
      await getPickerToken(createDb(env.DB), mockSession());
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(401);
      const body = res.toDomainError() as { code: string };
      expect(body.code).toBe('AUTH_PROVIDER_NOT_CONNECTED');
    }
  });

  it('refreshes expired token', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const user = await buildUser({ email: 'user1@example.com' });
    currentUser = { id: user.id, email: user.email };

    const expiredAt = new Date(Date.now() - 1000);
    await env.DB.prepare(
      `INSERT INTO account (id, userId, accountId, providerId, issuer, accessToken, refreshToken, accessTokenExpiresAt, createdAt, updatedAt)
       VALUES (?1, ?2, ?3, ?4, 'https://accounts.google.com', ?5, ?6, ?7, ?8, ?9)`,
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

    const result = await getPickerToken(createDb(env.DB), mockSession());
    expect(result.accessToken).toBe('new-token-456');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('oauth2.googleapis.com/token'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  async function seedExpiredGoogleAccount(userId: string, refreshToken: string | null) {
    const nowSec = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `INSERT INTO account (id, userId, accountId, providerId, issuer, accessToken, refreshToken, accessTokenExpiresAt, createdAt, updatedAt)
       VALUES (?1, ?2, ?3, ?4, 'https://accounts.google.com', ?5, ?6, ?7, ?8, ?9)`,
    )
      .bind(
        `acc-${userId}`,
        userId,
        `google-${userId}`,
        'google',
        'expired-token',
        refreshToken,
        nowSec - 60,
        nowSec,
        nowSec,
      )
      .run();
  }

  it('throws PROVIDER_NOT_CONNECTED when the token is expired and no refresh token exists', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    currentUser = { id: user.id, email: user.email };
    await seedExpiredGoogleAccount(user.id, null);

    try {
      await getPickerToken(createDb(env.DB), mockSession());
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as DomainErrorException;
      expect(res).toBeInstanceOf(DomainErrorException);
      expect(res.statusCode).toBe(401);
      expect(res.code).toBe('AUTH_PROVIDER_NOT_CONNECTED');
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws PROVIDER_NOT_CONNECTED when Google rejects the refresh token', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    currentUser = { id: user.id, email: user.email };
    await seedExpiredGoogleAccount(user.id, 'revoked-refresh');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => '{"error":"invalid_grant"}',
    } as unknown as Response);

    try {
      await getPickerToken(createDb(env.DB), mockSession());
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as DomainErrorException;
      expect(res).toBeInstanceOf(DomainErrorException);
      expect(res.statusCode).toBe(401);
      expect(res.code).toBe('AUTH_PROVIDER_NOT_CONNECTED');
    }
  });
});

describe('disconnectGoogle', () => {
  it('revokes the grant with Google and deletes the account row', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    await seedGoogleAccount(user.id);
    currentUser = { id: user.id, email: user.email };
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await disconnectGoogle(createDb(env.DB), mockSession());
    expect(result.success).toBe(true);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://oauth2.googleapis.com/revoke');
    expect(String(init.body)).toBe('token=refresh-123');

    const acct = await env.DB.prepare('SELECT * FROM account WHERE userId = ?1 AND providerId = ?2')
      .bind(user.id, 'google')
      .first();
    expect(acct).toBeNull();
  });

  it('still deletes the account row when Google rejects the revoke', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    await seedGoogleAccount(user.id);
    currentUser = { id: user.id, email: user.email };
    mockFetch.mockResolvedValueOnce(new Response('{"error":"invalid_token"}', { status: 400 }));

    const result = await disconnectGoogle(createDb(env.DB), mockSession());
    expect(result.success).toBe(true);

    const acct = await env.DB.prepare('SELECT * FROM account WHERE userId = ?1 AND providerId = ?2')
      .bind(user.id, 'google')
      .first();
    expect(acct).toBeNull();
  });

  it('skips the revoke call when no Google account is linked', async () => {
    const user = await buildUser({ email: 'user1@example.com' });
    currentUser = { id: user.id, email: user.email };

    await disconnectGoogle(createDb(env.DB), mockSession());
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('importFromDrive', () => {
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
            size: '5',
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(pdfData.buffer as ArrayBuffer, {
          headers: { 'Content-Type': 'application/pdf' },
        }),
      );

    const result = await importFromDrive(createDb(env.DB), mockSession(), {
      fileId: 'file-123',
      projectId: project.id,
      studyId: 'study-1',
    });

    expect(result.success).toBe(true);
    expect(result.file.fileName).toBe('document.pdf');
    expect(result.file.source).toBe('google-drive');

    // Shared-drive files need supportsAllDrives on both requests
    for (const call of mockFetch.mock.calls) {
      expect(String(call[0])).toContain('supportsAllDrives=true');
    }
  });

  it('rejects a download larger than the limit when Drive omits size', async () => {
    const { project, owner } = await buildProject();
    await seedGoogleAccount(owner.id);
    currentUser = { id: owner.id, email: owner.email };

    const pdfData = new Uint8Array(32);
    pdfData.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 'file-123', name: 'document.pdf', mimeType: 'application/pdf' }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(new Response(pdfData.buffer as ArrayBuffer));

    try {
      await importFromDrive(createDb(env.DB), mockSession(), {
        fileId: 'file-123',
        projectId: project.id,
        studyId: 'study-1',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(413);
      expect(res.code).toBe('FILE_TOO_LARGE');
    }

    const listed = await env.PDF_BUCKET.list({ prefix: `projects/${project.id}/` });
    expect(listed.objects).toHaveLength(0);
  });

  it('deletes the R2 object and fails when the mediaFiles insert fails', async () => {
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
            size: '5',
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(new Response(pdfData.buffer as ArrayBuffer));

    const db = createDb(env.DB);
    vi.spyOn(db, 'insert').mockImplementationOnce(() => {
      throw new Error('D1 write failed');
    });

    try {
      await importFromDrive(db, mockSession(), {
        fileId: 'file-123',
        projectId: project.id,
        studyId: 'study-1',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as DomainErrorException;
      expect(res).toBeInstanceOf(DomainErrorException);
      expect(res.code).toBe('FILE_UPLOAD_FAILED');
    }

    const listed = await env.PDF_BUCKET.list({ prefix: `projects/${project.id}/` });
    expect(listed.objects).toHaveLength(0);
    const rows = await env.DB.prepare('SELECT COUNT(*) AS n FROM mediaFiles').first<{
      n: number;
    }>();
    expect(rows?.n).toBe(0);
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
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: '1024',
      }),
    } as unknown as Response);

    try {
      await importFromDrive(createDb(env.DB), mockSession(), {
        fileId: 'file-123',
        projectId: project.id,
        studyId: 'study-1',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(400);
      const body = res.toDomainError() as { code: string };
      expect(body.code).toBe('FILE_INVALID_TYPE');
    }
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

    try {
      await importFromDrive(createDb(env.DB), mockSession(), {
        fileId: 'file-123',
        projectId: project.id,
        studyId: 'study-1',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(413);
      const body = res.toDomainError() as { code: string };
      expect(body.code).toBe('FILE_TOO_LARGE');
    }
  });
});
