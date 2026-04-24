import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import {
  buildUser,
  buildProject,
  buildProjectMember,
  resetCounter,
} from '@/__tests__/server/factories';
import { searchUsers } from '@/server/functions/users.server';

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

const dummyRequest = new Request('http://localhost/api/users/search');

describe('GET /api/users/search', () => {
  it('searches users by email', async () => {
    const me = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });
    await buildUser({ email: 'user3@example.com' });
    currentUser = { id: me.id, email: me.email };

    const result = await searchUsers(createDb(env.DB), mockSession(), dummyRequest, {
      q: 'user2',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(user2.id);
  });

  it('masks email when query does not include @', async () => {
    const me = await buildUser({ email: 'current@example.com' });
    await buildUser({ email: 'user2@example.com' });
    currentUser = { id: me.id, email: me.email };

    const result = await searchUsers(createDb(env.DB), mockSession(), dummyRequest, {
      q: 'user',
    });
    const u = result.find(x => x.email?.startsWith('us'));
    expect(u).toBeDefined();
    expect(u!.email).toMatch(/^us\*\*\*@example\.com$/);
  });

  it('returns full email when query includes @', async () => {
    const me = await buildUser({ email: 'current@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });
    currentUser = { id: me.id, email: me.email };

    const result = await searchUsers(createDb(env.DB), mockSession(), dummyRequest, {
      q: 'user2@example.com',
    });
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe(user2.email);
  });

  it('rejects query shorter than 2 characters', async () => {
    try {
      await searchUsers(createDb(env.DB), mockSession(), dummyRequest, { q: 'a' });
      expect.fail('Should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.code).toMatch(/VALIDATION/);
      expect(body.message).toMatch(/2 characters|too short/i);
    }
  });

  it('caps limit at 20', async () => {
    const me = await buildUser({ email: 'current@example.com' });
    for (let i = 0; i < 25; i++) {
      await buildUser({ email: `searchuser${i}@example.com` });
    }
    currentUser = { id: me.id, email: me.email };

    const result = await searchUsers(createDb(env.DB), mockSession(), dummyRequest, {
      q: 'searchuser',
      limit: 100,
    });
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('excludes current user', async () => {
    const me = await buildUser({ name: 'Current User', email: 'user1@example.com' });
    const other = await buildUser({ name: 'Other User', email: 'user2@example.com' });
    currentUser = { id: me.id, email: me.email };

    const result = await searchUsers(createDb(env.DB), mockSession(), dummyRequest, {
      q: 'user',
    });
    expect(result.find(u => u.id === me.id)).toBeUndefined();
    expect(result.find(u => u.id === other.id)).toBeDefined();
  });

  it('excludes project members when projectId provided', async () => {
    const { project, owner, org } = await buildProject();
    const projectMember = await buildProjectMember({
      projectId: project.id,
      orgId: org.id,
      role: 'member',
    });
    const outsider = await buildUser({ email: 'user3@example.com' });
    currentUser = { id: owner.id, email: owner.email };

    const result = await searchUsers(createDb(env.DB), mockSession(), dummyRequest, {
      q: 'user',
      projectId: project.id,
    });
    expect(result.find(u => u.id === projectMember.user.id)).toBeUndefined();
    expect(result.find(u => u.id === outsider.id)).toBeDefined();
  });

  it('searches by name', async () => {
    const me = await buildUser({ email: 'current@example.com' });
    const john = await buildUser({ name: 'John Doe', email: 'john@example.com' });
    currentUser = { id: me.id, email: me.email };

    const result = await searchUsers(createDb(env.DB), mockSession(), dummyRequest, {
      q: 'john',
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe(john.name);
  });

  it('searches by givenName', async () => {
    const me = await buildUser({ email: 'current@example.com' });
    const johnny = await buildUser({ givenName: 'Johnny', email: 'user2@example.com' });
    currentUser = { id: me.id, email: me.email };

    const result = await searchUsers(createDb(env.DB), mockSession(), dummyRequest, {
      q: 'johnny',
    });
    expect(result).toHaveLength(1);
    expect(result[0].givenName).toBe(johnny.givenName);
  });

  it('searches by username', async () => {
    const me = await buildUser({ email: 'current@example.com' });
    const johndoe = await buildUser({ username: 'johndoe', email: 'user2@example.com' });
    currentUser = { id: me.id, email: me.email };

    const result = await searchUsers(createDb(env.DB), mockSession(), dummyRequest, {
      q: 'johndoe',
    });
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe(johndoe.username);
  });

  it('is case-insensitive', async () => {
    const me = await buildUser({ email: 'current@example.com' });
    const john = await buildUser({ name: 'John Doe', email: 'john@example.com' });
    currentUser = { id: me.id, email: me.email };

    const result = await searchUsers(createDb(env.DB), mockSession(), dummyRequest, {
      q: 'JOHN',
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe(john.name);
  });
});
