/**
 * Admin routes tests
 *
 * These tests run in a Cloudflare Workers-like runtime via @cloudflare/vitest-pool-workers,
 * giving us a real D1 binding to exercise the Drizzle (d1) queries.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';

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

async function resetSchema() {
  // Keep schema minimal but compatible with the Drizzle table definitions used by admin routes.
  // NOTE: Avoid D1Database.exec() here; it can surface internal meta aggregation errors.
  const run = sql => env.DB.prepare(sql).run();

  await run('PRAGMA foreign_keys = ON');

  await run('DROP TABLE IF EXISTS project_members');
  await run('DROP TABLE IF EXISTS projects');
  await run('DROP TABLE IF EXISTS session');
  await run('DROP TABLE IF EXISTS user');

  await run(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      emailVerified INTEGER DEFAULT 0,
      image TEXT,
      createdAt INTEGER DEFAULT (unixepoch()),
      updatedAt INTEGER DEFAULT (unixepoch()),
      username TEXT UNIQUE,
      displayName TEXT,
      avatarUrl TEXT,
      role TEXT,
      twoFactorEnabled INTEGER DEFAULT 0,
      banned INTEGER DEFAULT 0,
      banReason TEXT,
      banExpires INTEGER
    )
  `);

  await run(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      createdBy TEXT NOT NULL,
      createdAt INTEGER DEFAULT (unixepoch()),
      updatedAt INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY(createdBy) REFERENCES user(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE project_members (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      joinedAt INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(userId) REFERENCES user(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE session (
      id TEXT PRIMARY KEY,
      expiresAt INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      createdAt INTEGER DEFAULT (unixepoch()),
      updatedAt INTEGER DEFAULT (unixepoch()),
      ipAddress TEXT,
      userAgent TEXT,
      userId TEXT NOT NULL,
      impersonatedBy TEXT,
      FOREIGN KEY(userId) REFERENCES user(id) ON DELETE CASCADE,
      FOREIGN KEY(impersonatedBy) REFERENCES user(id) ON DELETE SET NULL
    )
  `);
}

async function seedUser({
  id,
  name,
  email,
  createdAt,
  updatedAt,
  role = 'researcher',
  displayName = null,
  username = null,
  banned = 0,
  banReason = null,
  banExpires = null,
  emailVerified = 0,
}) {
  await env.DB.prepare(
    `INSERT INTO user (
      id, name, email, displayName, username, role,
      emailVerified, banned, banReason, banExpires, createdAt, updatedAt
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
  )
    .bind(
      id,
      name,
      email,
      displayName,
      username,
      role,
      emailVerified,
      banned,
      banReason,
      banExpires,
      createdAt,
      updatedAt,
    )
    .run();
}

async function seedProject({ id, name, createdBy, createdAt, updatedAt }) {
  await env.DB.prepare(
    `INSERT INTO projects (id, name, createdBy, createdAt, updatedAt)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  )
    .bind(id, name, createdBy, createdAt, updatedAt)
    .run();
}

async function seedProjectMember({ id, projectId, userId, role = 'member', joinedAt }) {
  await env.DB.prepare(
    `INSERT INTO project_members (id, projectId, userId, role, joinedAt)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  )
    .bind(id, projectId, userId, role, joinedAt)
    .run();
}

async function seedSession({ id, token, userId, expiresAt, createdAt, updatedAt }) {
  await env.DB.prepare(
    `INSERT INTO session (id, token, userId, expiresAt, createdAt, updatedAt)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  )
    .bind(id, token, userId, expiresAt, createdAt, updatedAt)
    .run();
}

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
  const { adminRoutes } = await import('../routes/admin.js');
  app = new Hono();
  app.route('/api/admin', adminRoutes);
});

beforeEach(async () => {
  await resetSchema();
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

    await seedProject({
      id: 'p1',
      name: 'Project 1',
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

    await seedProject({
      id: 'p1',
      name: 'Proj',
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
    expect(body.error).toMatch(/ban yourself/i);
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
    await seedProject({
      id: 'p1',
      name: 'Proj',
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
});
