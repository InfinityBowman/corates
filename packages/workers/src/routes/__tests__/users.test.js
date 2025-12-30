/**
 * Integration tests for user routes
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  clearProjectDOs,
  seedUser,
  seedProject,
  seedProjectMember,
  seedOrganization,
  seedOrgMember,
  json,
} from '../../__tests__/helpers.js';

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
vi.mock('../../middleware/auth.js', () => {
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
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-3',
      name: 'User 3',
      email: 'user3@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchUsers('/api/users/search?q=user2');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('user-2');
  });

  it('should mask email when query does not include @', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchUsers('/api/users/search?q=user');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.length).toBeGreaterThan(0);
    const user = body.find(u => u.id === 'user-2');
    expect(user).toBeDefined();
    expect(user.email).toMatch(/^us\*\*\*@example\.com$/);
  });

  it('should show full email when query includes @', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchUsers('/api/users/search?q=user2@example.com');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveLength(1);
    expect(body[0].email).toBe('user2@example.com');
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
    const nowSec = Math.floor(Date.now() / 1000);

    // Create 25 users
    for (let i = 0; i < 25; i++) {
      await seedUser({
        id: `user-${i}`,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        createdAt: nowSec,
        updatedAt: nowSec,
      });
    }

    const res = await fetchUsers('/api/users/search?q=user&limit=100');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.length).toBeLessThanOrEqual(20);
  });

  it('should exclude current user from results', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'Current User',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'Other User',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchUsers('/api/users/search?q=user');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.find(u => u.id === 'user-1')).toBeUndefined();
    expect(body.find(u => u.id === 'user-2')).toBeDefined();
  });

  it('should exclude users already in project when projectId provided', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-3',
      name: 'User 3',
      email: 'user3@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      orgId: 'org-1',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-2',
      role: 'member',
      joinedAt: nowSec,
    });

    const res = await fetchUsers('/api/users/search?q=user&projectId=project-1');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.find(u => u.id === 'user-2')).toBeUndefined();
    expect(body.find(u => u.id === 'user-3')).toBeDefined();
  });

  it('should search by name', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-2',
      name: 'John Doe',
      email: 'john@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchUsers('/api/users/search?q=john');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('John Doe');
  });

  it('should search by displayName', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      displayName: 'Johnny',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchUsers('/api/users/search?q=johnny');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveLength(1);
    expect(body[0].displayName).toBe('Johnny');
  });

  it('should search by username', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      username: 'johndoe',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchUsers('/api/users/search?q=johndoe');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveLength(1);
    expect(body[0].username).toBe('johndoe');
  });

  it('should be case-insensitive', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-2',
      name: 'John Doe',
      email: 'john@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchUsers('/api/users/search?q=JOHN');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('John Doe');
  });
});

describe('User Routes - GET /api/users/:userId/projects', () => {
  it('should return user projects', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Project 1',
      orgId: 'org-1',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-2',
      name: 'Project 2',
      orgId: 'org-1',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-2',
      projectId: 'project-2',
      userId: 'user-1',
      role: 'member',
      joinedAt: nowSec,
    });

    const res = await fetchUsers('/api/users/user-1/projects');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveLength(2);
    expect(body[0].id).toBeDefined();
    expect(body[0].name).toBeDefined();
    expect(body[0].role).toBeDefined();
  });

  it('should deny access to other users projects', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchUsers('/api/users/user-2/projects');
    expect(res.status).toBe(403);

    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/AUTH_FORBIDDEN/);
    expect(body.message || body.error).toBeDefined();
  });
});

describe('User Routes - DELETE /api/users/me', () => {
  it('should delete user account and cascade data', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Project 1',
      orgId: 'org-1',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    const res = await fetchUsers('/api/users/me', {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);

    // Verify user was deleted (D1 returns null, not undefined)
    const user = await env.DB.prepare('SELECT * FROM user WHERE id = ?1').bind('user-1').first();
    expect(user).toBeNull();

    // Verify project members were cascade deleted
    const members = await env.DB.prepare('SELECT * FROM project_members WHERE userId = ?1')
      .bind('user-1')
      .all();
    expect(members.results).toHaveLength(0);
  });

  it('should set mediaFiles.uploadedBy to null when deleting user', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    // Create a media file owned by the user
    await env.DB.prepare(
      'INSERT INTO mediaFiles (id, filename, bucketKey, uploadedBy, createdAt) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind('media-1', 'test.pdf', 'bucket-key-1', 'user-1', nowSec)
      .run();

    const res = await fetchUsers('/api/users/me', {
      method: 'DELETE',
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
