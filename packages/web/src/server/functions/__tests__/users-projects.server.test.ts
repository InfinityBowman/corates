import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildUser, buildProject, resetCounter } from '@/__tests__/server/factories';
import { fetchUserProjects } from '@/server/functions/users.server';

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

    const result = await fetchUserProjects(createDb(env.DB), mockSession(), owner.id);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBeDefined();
    expect(result[0].name).toBeDefined();
    expect(result[0].role).toBeDefined();
  });

  it('denies access to another user projects', async () => {
    const me = await buildUser({ email: 'user1@example.com' });
    const other = await buildUser({ email: 'user2@example.com' });
    currentUser = { id: me.id, email: me.email };

    try {
      await fetchUserProjects(createDb(env.DB), mockSession(), other.id);
      expect.fail('Should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.code).toMatch(/AUTH_FORBIDDEN/);
    }
  });
});
