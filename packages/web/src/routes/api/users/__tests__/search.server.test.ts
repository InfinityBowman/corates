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
import { handler } from '../search';

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

function get(pathAndQuery: string): Request {
  return new Request(`http://localhost${pathAndQuery}`, { method: 'GET' });
}

describe('GET /api/users/search', () => {
  it('searches users by email', async () => {
    const me = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });
    await buildUser({ email: 'user3@example.com' });
    currentUser = { id: me.id, email: me.email };

    const res = await handler({ request: get('/api/users/search?q=user2'), context: { db: createDb(env.DB), session: mockSession() } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(user2.id);
  });

  it('masks email when query does not include @', async () => {
    const me = await buildUser({ email: 'current@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });
    currentUser = { id: me.id, email: me.email };

    const res = await handler({ request: get('/api/users/search?q=user'), context: { db: createDb(env.DB), session: mockSession() } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    const u = body.find(x => x.id === user2.id);
    expect(u).toBeDefined();
    expect(u.email).toMatch(/^us\*\*\*@example\.com$/);
  });

  it('returns full email when query includes @', async () => {
    const me = await buildUser({ email: 'current@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });
    currentUser = { id: me.id, email: me.email };

    const res = await handler({
      request: get('/api/users/search?q=user2@example.com'),
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body).toHaveLength(1);
    expect(body[0].email).toBe(user2.email);
  });

  it('rejects query shorter than 2 characters', async () => {
    const res = await handler({ request: get('/api/users/search?q=a'), context: { db: createDb(env.DB), session: mockSession() } });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toMatch(/VALIDATION/);
    expect(body.message).toMatch(/2 characters|too short/i);
  });

  it('caps limit at 20', async () => {
    const me = await buildUser({ email: 'current@example.com' });
    for (let i = 0; i < 25; i++) {
      await buildUser({ email: `searchuser${i}@example.com` });
    }
    currentUser = { id: me.id, email: me.email };

    const res = await handler({
      request: get('/api/users/search?q=searchuser&limit=100'),
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body.length).toBeLessThanOrEqual(20);
  });

  it('excludes current user', async () => {
    const me = await buildUser({ name: 'Current User', email: 'user1@example.com' });
    const other = await buildUser({ name: 'Other User', email: 'user2@example.com' });
    currentUser = { id: me.id, email: me.email };

    const res = await handler({ request: get('/api/users/search?q=user'), context: { db: createDb(env.DB), session: mockSession() } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body.find(u => u.id === me.id)).toBeUndefined();
    expect(body.find(u => u.id === other.id)).toBeDefined();
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

    const res = await handler({
      request: get(`/api/users/search?q=user&projectId=${project.id}`),
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body.find(u => u.id === projectMember.user.id)).toBeUndefined();
    expect(body.find(u => u.id === outsider.id)).toBeDefined();
  });

  it('searches by name', async () => {
    const me = await buildUser({ email: 'current@example.com' });
    const john = await buildUser({ name: 'John Doe', email: 'john@example.com' });
    currentUser = { id: me.id, email: me.email };

    const res = await handler({ request: get('/api/users/search?q=john'), context: { db: createDb(env.DB), session: mockSession() } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe(john.name);
  });

  it('searches by givenName', async () => {
    const me = await buildUser({ email: 'current@example.com' });
    const johnny = await buildUser({ givenName: 'Johnny', email: 'user2@example.com' });
    currentUser = { id: me.id, email: me.email };

    const res = await handler({ request: get('/api/users/search?q=johnny'), context: { db: createDb(env.DB), session: mockSession() } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body).toHaveLength(1);
    expect(body[0].givenName).toBe(johnny.givenName);
  });

  it('searches by username', async () => {
    const me = await buildUser({ email: 'current@example.com' });
    const johndoe = await buildUser({ username: 'johndoe', email: 'user2@example.com' });
    currentUser = { id: me.id, email: me.email };

    const res = await handler({ request: get('/api/users/search?q=johndoe'), context: { db: createDb(env.DB), session: mockSession() } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body).toHaveLength(1);
    expect(body[0].username).toBe(johndoe.username);
  });

  it('is case-insensitive', async () => {
    const me = await buildUser({ email: 'current@example.com' });
    const john = await buildUser({ name: 'John Doe', email: 'john@example.com' });
    currentUser = { id: me.id, email: me.email };

    const res = await handler({ request: get('/api/users/search?q=JOHN'), context: { db: createDb(env.DB), session: mockSession() } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe(john.name);
  });
});
