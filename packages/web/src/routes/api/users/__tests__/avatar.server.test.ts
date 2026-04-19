import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildUser, buildProject, resetCounter } from '@/__tests__/server/factories';
import { handlePost, handleDelete } from '../avatar';
import { handler as getHandler } from '../avatar/$userId';

let currentUser: { id: string; email: string } = {
  id: 'user-1',
  email: 'user1@example.com',
};

function mockSession() {
  return {
    user: { id: currentUser.id, email: currentUser.email, name: 'Test User' },
    session: { id: 'test-session', userId: currentUser.id },
  };
}

vi.mock('@corates/workers/project-doc-id', () => ({
  getProjectDocStub: vi.fn(() => ({
    syncMember: vi.fn(async () => {}),
  })),
}));

let mockGetProjectDocStub: Mock;

async function clearR2(prefix: string) {
  const listed = await env.PDF_BUCKET.list({ prefix });
  for (const obj of listed.objects) {
    await env.PDF_BUCKET.delete(obj.key);
  }
}

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  await clearProjectDOs(['project-1']);
  await clearR2('avatars/');
  vi.clearAllMocks();
  currentUser = { id: 'user-1', email: 'user1@example.com' };

  const mod = await import('@corates/workers/project-doc-id');
  mockGetProjectDocStub = mod.getProjectDocStub as unknown as Mock;
  mockGetProjectDocStub.mockImplementation(() => ({
    syncMember: vi.fn(async () => {}),
  }));
});

function req(path: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost${path}`, init);
}

describe('POST /api/users/avatar', () => {
  it('uploads avatar successfully', async () => {
    const user = await buildUser();
    currentUser = { id: user.id, email: user.email };

    const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([imageData], 'avatar.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await handlePost({
      request: req('/api/users/avatar', { method: 'POST', body: formData }),
      context: { db: createDb(env.DB), session: mockSession() },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; url: string; key: string };
    expect(body.success).toBe(true);
    expect(body.url).toMatch(new RegExp(`^/api/users/avatar/${user.id}\\?t=\\d+$`));
    expect(body.key).toMatch(new RegExp(`^avatars/${user.id}/\\d+\\.(jpg|jpeg|png|gif|webp)$`));
  });

  it('rejects files that are too large (Content-Length)', async () => {
    const user = await buildUser();
    currentUser = { id: user.id, email: user.email };

    const largeFile = new File([new ArrayBuffer(3 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    });
    const formData = new FormData();
    formData.append('avatar', largeFile);

    const res = await handlePost({
      request: req('/api/users/avatar', {
        method: 'POST',
        headers: { 'Content-Length': String(3 * 1024 * 1024) },
        body: formData,
      }),
      context: { db: createDb(env.DB), session: mockSession() },
    });

    expect(res.status).toBe(413);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects invalid file types', async () => {
    const user = await buildUser();
    currentUser = { id: user.id, email: user.email };

    const file = new File(['not an image'], 'document.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await handlePost({
      request: req('/api/users/avatar', { method: 'POST', body: formData }),
      context: { db: createDb(env.DB), session: mockSession() },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('FILE_INVALID_TYPE');
  });

  it('deletes old avatar when uploading new one', async () => {
    const user = await buildUser();
    currentUser = { id: user.id, email: user.email };

    const imageData1 = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file1 = new File([imageData1], 'avatar1.jpg', { type: 'image/jpeg' });
    const formData1 = new FormData();
    formData1.append('avatar', file1);

    const res1 = await handlePost({
      request: req('/api/users/avatar', { method: 'POST', body: formData1 }),
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as { key: string };
    const firstKey = body1.key;

    // Small wait to ensure timestamps differ
    await new Promise(r => setTimeout(r, 5));

    const imageData2 = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const file2 = new File([imageData2], 'avatar2.png', { type: 'image/png' });
    const formData2 = new FormData();
    formData2.append('avatar', file2);

    const res2 = await handlePost({
      request: req('/api/users/avatar', { method: 'POST', body: formData2 }),
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res2.status).toBe(200);

    const oldObj = await env.PDF_BUCKET.get(firstKey);
    expect(oldObj).toBeNull();

    const body2 = (await res2.json()) as { key: string };
    const newObj = await env.PDF_BUCKET.get(body2.key);
    expect(newObj).not.toBeNull();
  });

  it('syncs avatar to project memberships', async () => {
    const { project, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const syncMember = vi.fn(async () => {});
    mockGetProjectDocStub.mockImplementation(() => ({ syncMember }));

    const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([imageData], 'avatar.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await handlePost({
      request: req('/api/users/avatar', { method: 'POST', body: formData }),
      context: { db: createDb(env.DB), session: mockSession() },
    });

    expect(res.status).toBe(200);
    expect(mockGetProjectDocStub).toHaveBeenCalledWith(expect.any(Object), project.id);
    expect(syncMember).toHaveBeenCalledWith(
      'update',
      expect.objectContaining({
        userId: owner.id,
        image: expect.stringMatching(new RegExp(`^/api/users/avatar/${owner.id}\\?t=\\d+$`)),
      }),
    );
  });
});

describe('GET /api/users/avatar/:userId', () => {
  it('returns avatar image', async () => {
    const user = await buildUser();
    currentUser = { id: user.id, email: user.email };

    const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    await env.PDF_BUCKET.put(`avatars/${user.id}/1234567890.jpg`, imageData, {
      httpMetadata: { contentType: 'image/jpeg' },
    });

    const res = await getHandler({
      request: req(`/api/users/avatar/${user.id}`),
      params: { userId: user.id },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000');
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
  });

  it('returns 404 when avatar not found', async () => {
    const user = await buildUser();
    currentUser = { id: user.id, email: user.email };

    const res = await getHandler({
      request: req(`/api/users/avatar/${user.id}`),
      params: { userId: user.id },
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('FILE_NOT_FOUND');
  });
});

describe('DELETE /api/users/avatar', () => {
  it('deletes user avatar', async () => {
    const user = await buildUser();
    currentUser = { id: user.id, email: user.email };

    const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    await env.PDF_BUCKET.put(`avatars/${user.id}/1234567890.jpg`, imageData, {
      httpMetadata: { contentType: 'image/jpeg' },
    });

    const res = await handleDelete({
      request: req('/api/users/avatar', { method: 'DELETE' }),
      context: { session: mockSession() },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    const listed = await env.PDF_BUCKET.list({ prefix: `avatars/${user.id}/` });
    expect(listed.objects.length).toBe(0);
  });

  it('handles deletion when no avatar exists', async () => {
    const user = await buildUser();
    currentUser = { id: user.id, email: user.email };

    const res = await handleDelete({
      request: req('/api/users/avatar', { method: 'DELETE' }),
      context: { session: mockSession() },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });
});
