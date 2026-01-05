/**
 * Admin routes tests
 *
 * These tests run in a Cloudflare Workers-like runtime via @cloudflare/vitest-pool-workers,
 * giving us a real D1 binding to exercise the Drizzle (d1) queries.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock postmark to avoid loading runtime code that may include unhandled syntax
// in the test environment. Tests only need to assert email usage paths, not the
// real Postmark client implementation.
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
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  clearProjectDOs,
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedProject,
  seedProjectMember,
  seedSession,
} from './helpers.js';

// Mock admin auth middleware so we can focus on admin route behavior.
// We still test CSRF/trusted-origin behavior using the real middleware.
vi.mock('../middleware/requireAdmin.js', () => {
  return {
    isAdmin: () => true,
    requireAdmin: async (c, next) => {
      const adminId = c.req.raw.headers.get('x-test-admin-id') || 'admin-user';
      c.set('user', {
        id: adminId,
        role: 'admin',
        email: 'admin@example.com',
        name: 'Admin User',
      });
      c.set('session', { id: 'admin-session' });
      c.set('isAdmin', true);
      await next();
    },
  };
});

let app;

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

async function fetchApp(path, init = {}) {
  const ctx = createExecutionContext();
  const req = new Request(`http://localhost${path}`, init);
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

beforeAll(async () => {
  const { adminRoutes } = await import('../routes/admin/index.js');
  app = new Hono();
  app.route('/api/admin', adminRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();
  // Clear ProjectDoc DOs to prevent invalidation errors between tests
  await clearProjectDOs(['p1']);
});

describe('Admin API routes', () => {
  it('GET /api/admin/check returns admin user info', async () => {
    const res = await fetchApp('/api/admin/check');
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.isAdmin).toBe(true);
    expect(body.user).toHaveProperty('id');
    expect(body.user).toHaveProperty('email');
  });

  it('GET /api/admin/stats returns correct counts and recentSignups', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const eightDaysAgo = nowSec - 8 * 24 * 60 * 60;

    await seedUser({
      id: 'u1',
      name: 'Recent User',
      email: 'recent@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });
    await seedUser({
      id: 'u2',
      name: 'Old User',
      email: 'old@example.com',
      createdAt: eightDaysAgo,
      updatedAt: eightDaysAgo,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedProject({
      id: 'p1',
      name: 'Project 1',
      orgId: 'org-1',
      createdBy: 'u1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedSession({
      id: 's1',
      token: 't1',
      userId: 'u1',
      expiresAt: nowSec + 60 * 60,
      createdAt: nowSec,
      updatedAt: nowSec,
    });
    await seedSession({
      id: 's2',
      token: 't2',
      userId: 'u1',
      expiresAt: nowSec + 60 * 60,
      createdAt: nowSec,
      updatedAt: nowSec,
    });
    await seedSession({
      id: 's3',
      token: 't3',
      userId: 'u2',
      expiresAt: nowSec + 60 * 60,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchApp('/api/admin/stats');
    expect(res.status).toBe(200);
    const body = await json(res);

    expect(body.users).toBe(2);
    expect(body.projects).toBe(1);
    expect(body.activeSessions).toBe(3);
    expect(body.recentSignups).toBe(1);
  });

  it('GET /api/admin/users supports pagination', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'u1',
      name: 'U1',
      email: 'u1@example.com',
      createdAt: nowSec - 1,
      updatedAt: nowSec - 1,
    });
    await seedUser({
      id: 'u2',
      name: 'U2',
      email: 'u2@example.com',
      createdAt: nowSec - 2,
      updatedAt: nowSec - 2,
    });
    await seedUser({
      id: 'u3',
      name: 'U3',
      email: 'u3@example.com',
      createdAt: nowSec - 3,
      updatedAt: nowSec - 3,
    });

    const res = await fetchApp('/api/admin/users?page=1&limit=2');
    expect(res.status).toBe(200);
    const body = await json(res);

    expect(body.users).toHaveLength(2);
    expect(body.pagination).toMatchObject({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it('GET /api/admin/users supports search', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'u1',
      name: 'Alice',
      email: 'alice@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });
    await seedUser({
      id: 'u2',
      name: 'Bob',
      email: 'bob@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchApp('/api/admin/users?search=ALICE%40example.com');
    expect(res.status).toBe(200);
    const body = await json(res);

    expect(body.users).toHaveLength(1);
    expect(body.users[0].email).toBe('alice@example.com');
    expect(body.pagination.total).toBe(1);
  });

  it('GET /api/admin/users/:userId returns user, projects, and sessions', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'u1',
      name: 'Target',
      email: 'target@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });
    await seedUser({
      id: 'u2',
      name: 'Owner',
      email: 'owner@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedProject({
      id: 'p1',
      name: 'Proj',
      orgId: 'org-1',
      createdBy: 'u2',
      createdAt: nowSec,
      updatedAt: nowSec,
    });
    await seedProjectMember({
      id: 'pm1',
      projectId: 'p1',
      userId: 'u1',
      role: 'member',
      joinedAt: nowSec,
    });

    await seedSession({
      id: 's1',
      token: 'tok1',
      userId: 'u1',
      expiresAt: nowSec + 1000,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchApp('/api/admin/users/u1');
    expect(res.status).toBe(200);
    const body = await json(res);

    expect(body).toHaveProperty('user');
    expect(body).toHaveProperty('projects');
    expect(body).toHaveProperty('sessions');
    expect(body.user.id).toBe('u1');
    expect(body.projects).toHaveLength(1);
    expect(body.sessions).toHaveLength(1);
  });

  it('POST /api/admin/users/:userId/ban enforces trusted origin and bans user', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'u1',
      name: 'Target',
      email: 'target@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });
    await seedSession({
      id: 's1',
      token: 'tok1',
      userId: 'u1',
      expiresAt: nowSec + 1000,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    // Missing Origin/Referer should be blocked by CSRF middleware.
    const blocked = await fetchApp('/api/admin/users/u1/ban', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Abuse' }),
    });
    expect(blocked.status).toBe(403);
    const blockedBody = await json(blocked);
    expect(blockedBody.error).toMatch(/Origin|Referer/i);

    // Trusted origin should allow the request.
    const allowed = await fetchApp('/api/admin/users/u1/ban', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:5173',
      },
      body: JSON.stringify({ reason: 'Abuse' }),
    });

    expect(allowed.status).toBe(200);
    const allowedBody = await json(allowed);
    expect(allowedBody.success).toBe(true);

    const userRow = await env.DB.prepare('SELECT banned, banReason FROM user WHERE id = ?1')
      .bind('u1')
      .first();
    expect(userRow.banned).toBe(1);
    expect(userRow.banReason).toBe('Abuse');

    const sessionCount = await env.DB.prepare('SELECT COUNT(*) as c FROM session WHERE userId = ?1')
      .bind('u1')
      .first();
    expect(sessionCount.c).toBe(0);
  });

  it('POST /api/admin/users/:userId/ban prevents banning yourself', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'self',
      name: 'Self',
      email: 'self@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchApp('/api/admin/users/self/ban', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:5173',
        'x-test-admin-id': 'self',
      },
      body: JSON.stringify({ reason: 'Nope' }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/VALIDATION/);
    // Check for validation error - message may be generic "Invalid input" but code indicates the issue
    expect(body.details?.constraint).toMatch(/cannot_ban_self/i);
  });

  it('DELETE /api/admin/users/:userId deletes user data (and blocks self-delete)', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'admin-user',
      name: 'Admin',
      email: 'admin@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });
    await seedUser({
      id: 'u1',
      name: 'Target',
      email: 'target@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedProject({
      id: 'p1',
      name: 'Proj',
      orgId: 'org-1',
      createdBy: 'u1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });
    await seedProjectMember({
      id: 'pm1',
      projectId: 'p1',
      userId: 'u1',
      role: 'owner',
      joinedAt: nowSec,
    });
    await seedSession({
      id: 's1',
      token: 'tok1',
      userId: 'u1',
      expiresAt: nowSec + 1000,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    // Self-delete blocked
    const selfDelete = await fetchApp('/api/admin/users/admin-user', {
      method: 'DELETE',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(selfDelete.status).toBe(400);

    // Delete target
    const del = await fetchApp('/api/admin/users/u1', {
      method: 'DELETE',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(del.status).toBe(200);
    const delBody = await json(del);
    expect(delBody.success).toBe(true);

    const remainingUser = await env.DB.prepare('SELECT id FROM user WHERE id = ?1')
      .bind('u1')
      .first();
    expect(remainingUser).toBeNull();

    const remainingProjects = await env.DB.prepare(
      'SELECT COUNT(*) as c FROM projects WHERE createdBy = ?1',
    )
      .bind('u1')
      .first();
    expect(remainingProjects.c).toBe(0);
  });

  it('DELETE /api/admin/users/:userId should set mediaFiles.uploadedBy to null', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'admin-user',
      name: 'Admin',
      email: 'admin@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });
    await seedUser({
      id: 'u1',
      name: 'Target',
      email: 'target@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });
    await seedUser({
      id: 'u2',
      name: 'Owner',
      email: 'owner@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    // Create project with a different user as creator so it doesn't get deleted
    await seedProject({
      id: 'p1',
      name: 'Project 1',
      orgId: 'org-1',
      createdBy: 'u2',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    // Create a media file owned by the user to be deleted
    await env.DB.prepare(
      'INSERT INTO mediaFiles (id, filename, bucketKey, uploadedBy, orgId, projectId, createdAt) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
    )
      .bind('media-1', 'test.pdf', 'bucket-key-1', 'u1', 'org-1', 'p1', nowSec)
      .run();

    const del = await fetchApp('/api/admin/users/u1', {
      method: 'DELETE',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(del.status).toBe(200);

    // Verify media file still exists but uploadedBy is null
    const mediaFile = await env.DB.prepare('SELECT * FROM mediaFiles WHERE id = ?1')
      .bind('media-1')
      .first();
    expect(mediaFile).not.toBeNull();
    expect(mediaFile.uploadedBy).toBeNull();
  });
});
