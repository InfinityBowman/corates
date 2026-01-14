/**
 * Integration tests for user routes
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  clearProjectDOs,
  json,
} from '@/__tests__/helpers.js';
import {
  buildUser,
  buildProject,
  buildProjectMember,
  resetCounter,
} from '@/__tests__/factories';

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
        displayName: 'Test User',
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

beforeAll(async () => {
  const { userRoutes } = await import('../users.js');
  app = new Hono();
  app.route('/api/users', userRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  // Clear ProjectDoc DOs to prevent invalidation errors between tests
  await clearProjectDOs(['project-1']);
});

async function fetchUsers(path, init = {}) {
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

describe('User Routes - GET /api/users/search', () => {
  it('should search users by email', async () => {
    const currentUser = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });
    await buildUser({ email: 'user3@example.com' });

    const res = await fetchUsers('/api/users/search?q=user2', {
      headers: { 'x-test-user-id': currentUser.id, 'x-test-user-email': currentUser.email },
    });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(user2.id);
  });

  it('should mask email when query does not include @', async () => {
    const currentUser = await buildUser({ email: 'current@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });

    const res = await fetchUsers('/api/users/search?q=user', {
      headers: { 'x-test-user-id': currentUser.id, 'x-test-user-email': currentUser.email },
    });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.length).toBeGreaterThan(0);
    const user = body.find(u => u.id === user2.id);
    expect(user).toBeDefined();
    expect(user.email).toMatch(/^us\*\*\*@example\.com$/);
  });

  it('should show full email when query includes @', async () => {
    const currentUser = await buildUser({ email: 'current@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });

    const res = await fetchUsers('/api/users/search?q=user2@example.com', {
      headers: { 'x-test-user-id': currentUser.id, 'x-test-user-email': currentUser.email },
    });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveLength(1);
    expect(body[0].email).toBe(user2.email);
  });

  it('should reject query shorter than 2 characters', async () => {
    const res = await fetchUsers('/api/users/search?q=a');
    expect(res.status).toBe(400);

    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/VALIDATION/);
    expect(body.message || body.error).toMatch(/2 characters|too short/i);
  });

  it('should enforce limit cap at 20', async () => {
    const currentUser = await buildUser({ email: 'current@example.com' });

    // Create 25 users
    for (let i = 0; i < 25; i++) {
      await buildUser({ email: `searchuser${i}@example.com` });
    }

    const res = await fetchUsers('/api/users/search?q=searchuser&limit=100', {
      headers: { 'x-test-user-id': currentUser.id, 'x-test-user-email': currentUser.email },
    });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.length).toBeLessThanOrEqual(20);
  });

  it('should exclude current user from results', async () => {
    const currentUser = await buildUser({ name: 'Current User', email: 'user1@example.com' });
    const otherUser = await buildUser({ name: 'Other User', email: 'user2@example.com' });

    const res = await fetchUsers('/api/users/search?q=user', {
      headers: { 'x-test-user-id': currentUser.id, 'x-test-user-email': currentUser.email },
    });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.find(u => u.id === currentUser.id)).toBeUndefined();
    expect(body.find(u => u.id === otherUser.id)).toBeDefined();
  });

  it('should exclude users already in project when projectId provided', async () => {
    const { project, owner } = await buildProject();
    const projectMember = await buildProjectMember({ projectId: project.id, role: 'member' });
    const nonProjectUser = await buildUser({ email: 'user3@example.com' });

    const res = await fetchUsers(`/api/users/search?q=user&projectId=${project.id}`, {
      headers: { 'x-test-user-id': owner.id, 'x-test-user-email': owner.email },
    });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.find(u => u.id === projectMember.user.id)).toBeUndefined();
    expect(body.find(u => u.id === nonProjectUser.id)).toBeDefined();
  });

  it('should search by name', async () => {
    const currentUser = await buildUser({ email: 'current@example.com' });
    const john = await buildUser({ name: 'John Doe', email: 'john@example.com' });

    const res = await fetchUsers('/api/users/search?q=john', {
      headers: { 'x-test-user-id': currentUser.id, 'x-test-user-email': currentUser.email },
    });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe(john.name);
  });

  it('should search by displayName', async () => {
    const currentUser = await buildUser({ email: 'current@example.com' });
    const johnny = await buildUser({ displayName: 'Johnny', email: 'user2@example.com' });

    const res = await fetchUsers('/api/users/search?q=johnny', {
      headers: { 'x-test-user-id': currentUser.id, 'x-test-user-email': currentUser.email },
    });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveLength(1);
    expect(body[0].displayName).toBe(johnny.displayName);
  });

  it('should search by username', async () => {
    const currentUser = await buildUser({ email: 'current@example.com' });
    const johndoe = await buildUser({ username: 'johndoe', email: 'user2@example.com' });

    const res = await fetchUsers('/api/users/search?q=johndoe', {
      headers: { 'x-test-user-id': currentUser.id, 'x-test-user-email': currentUser.email },
    });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveLength(1);
    expect(body[0].username).toBe(johndoe.username);
  });

  it('should be case-insensitive', async () => {
    const currentUser = await buildUser({ email: 'current@example.com' });
    const john = await buildUser({ name: 'John Doe', email: 'john@example.com' });

    const res = await fetchUsers('/api/users/search?q=JOHN', {
      headers: { 'x-test-user-id': currentUser.id, 'x-test-user-email': currentUser.email },
    });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe(john.name);
  });
});

describe('User Routes - GET /api/users/:userId/projects', () => {
  it('should return user projects', async () => {
    // Create first project with owner
    const { owner, org } = await buildProject();
    // Create second project in same org with same owner as member
    await buildProject({ org, owner });

    const res = await fetchUsers(`/api/users/${owner.id}/projects`, {
      headers: { 'x-test-user-id': owner.id, 'x-test-user-email': owner.email },
    });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveLength(2);
    expect(body[0].id).toBeDefined();
    expect(body[0].name).toBeDefined();
    expect(body[0].role).toBeDefined();
  });

  it('should deny access to other users projects', async () => {
    const currentUser = await buildUser({ email: 'user1@example.com' });
    const otherUser = await buildUser({ email: 'user2@example.com' });

    const res = await fetchUsers(`/api/users/${otherUser.id}/projects`, {
      headers: { 'x-test-user-id': currentUser.id, 'x-test-user-email': currentUser.email },
    });
    expect(res.status).toBe(403);

    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/AUTH_FORBIDDEN/);
    expect(body.message || body.error).toBeDefined();
  });
});

describe('User Routes - DELETE /api/users/me', () => {
  it('should delete user account and cascade data', async () => {
    const { owner } = await buildProject();

    const res = await fetchUsers('/api/users/me', {
      method: 'DELETE',
      headers: { 'x-test-user-id': owner.id, 'x-test-user-email': owner.email },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);

    // Verify user was deleted (D1 returns null, not undefined)
    const user = await env.DB.prepare('SELECT * FROM user WHERE id = ?1').bind(owner.id).first();
    expect(user).toBeNull();

    // Verify project members were cascade deleted
    const members = await env.DB.prepare('SELECT * FROM project_members WHERE userId = ?1')
      .bind(owner.id)
      .all();
    expect(members.results).toHaveLength(0);
  });

  it('should set mediaFiles.uploadedBy to null when deleting user', async () => {
    // Create a project with a different owner so it doesn't get deleted
    const { project, org } = await buildProject();
    // Create the user who will be deleted
    const userToDelete = await buildUser({ email: 'todelete@example.com' });
    const nowSec = Math.floor(Date.now() / 1000);

    // Create a media file owned by the user being deleted
    await env.DB.prepare(
      'INSERT INTO mediaFiles (id, filename, bucketKey, uploadedBy, orgId, projectId, createdAt) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
    )
      .bind('media-1', 'test.pdf', 'bucket-key-1', userToDelete.id, org.id, project.id, nowSec)
      .run();

    const res = await fetchUsers('/api/users/me', {
      method: 'DELETE',
      headers: { 'x-test-user-id': userToDelete.id, 'x-test-user-email': userToDelete.email },
    });

    expect(res.status).toBe(200);

    // Verify media file still exists but uploadedBy is null
    const mediaFile = await env.DB.prepare('SELECT * FROM mediaFiles WHERE id = ?1')
      .bind('media-1')
      .first();
    expect(mediaFile).not.toBeNull();
    expect(mediaFile.uploadedBy).toBeNull();
  });
});
