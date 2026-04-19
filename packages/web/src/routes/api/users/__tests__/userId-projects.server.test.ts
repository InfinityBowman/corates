import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildUser, buildProject, resetCounter } from '@/__tests__/server/factories';
import { handler } from '../$userId/projects';

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

describe('GET /api/users/:userId/projects', () => {
  it('returns projects for the current user', async () => {
    const { owner, org } = await buildProject();
    await buildProject({ org, owner });
    currentUser = { id: owner.id, email: owner.email };

    const res = await handler({
      request: new Request(`http://localhost/api/users/${owner.id}/projects`),
      params: { userId: owner.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body).toHaveLength(2);
    expect(body[0].id).toBeDefined();
    expect(body[0].name).toBeDefined();
    expect(body[0].role).toBeDefined();
  });

  it('denies access to another user projects', async () => {
    const me = await buildUser({ email: 'user1@example.com' });
    const other = await buildUser({ email: 'user2@example.com' });
    currentUser = { id: me.id, email: me.email };

    const res = await handler({
      request: new Request(`http://localhost/api/users/${other.id}/projects`),
      params: { userId: other.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.code).toMatch(/AUTH_FORBIDDEN/);
  });
});
