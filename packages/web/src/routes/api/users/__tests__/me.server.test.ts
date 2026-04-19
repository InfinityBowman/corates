import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildUser, buildProject, resetCounter } from '@/__tests__/server/factories';
import { handleDelete } from '../me';

let currentUser = { id: 'user-1', email: 'user1@example.com' };

function mockSession() {
  return {
    user: { id: currentUser.id, email: currentUser.email, name: 'Test User' },
    session: { id: 'test-session', userId: currentUser.id },
  };
}

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  await clearProjectDOs(['project-1']);
  currentUser = { id: 'user-1', email: 'user1@example.com' };
});

describe('DELETE /api/users/me', () => {
  it('deletes user account and cascades related rows', async () => {
    const { owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await handleDelete({
      request: new Request('http://localhost/api/users/me', { method: 'DELETE' }),
      context: { db: createDb(env.DB), session: mockSession() },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);

    const userRow = await env.DB.prepare('SELECT * FROM user WHERE id = ?1').bind(owner.id).first();
    expect(userRow).toBeNull();

    const members = await env.DB.prepare('SELECT * FROM project_members WHERE userId = ?1')
      .bind(owner.id)
      .all();
    expect(members.results).toHaveLength(0);
  });

  it('sets mediaFiles.uploadedBy to null instead of deleting the files', async () => {
    const { project, org } = await buildProject();
    const userToDelete = await buildUser({ email: 'todelete@example.com' });
    const nowSec = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      'INSERT INTO mediaFiles (id, filename, bucketKey, uploadedBy, orgId, projectId, createdAt) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
    )
      .bind('media-1', 'test.pdf', 'bucket-key-1', userToDelete.id, org.id, project.id, nowSec)
      .run();

    currentUser = { id: userToDelete.id, email: userToDelete.email };

    const res = await handleDelete({
      request: new Request('http://localhost/api/users/me', { method: 'DELETE' }),
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(200);

    const mediaFile = await env.DB.prepare('SELECT * FROM mediaFiles WHERE id = ?1')
      .bind('media-1')
      .first<{ uploadedBy: string | null }>();
    expect(mediaFile).not.toBeNull();
    expect(mediaFile!.uploadedBy).toBeNull();
  });
});
