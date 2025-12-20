/**
 * Shared test utilities for workers tests
 */

import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';

/**
 * Reset database schema for tests
 */
export async function resetTestDatabase() {
  const run = sql => env.DB.prepare(sql).run();

  await run('PRAGMA foreign_keys = ON');

  // Drop tables in reverse dependency order
  await run('DROP TABLE IF EXISTS subscriptions');
  await run('DROP TABLE IF EXISTS twoFactor');
  await run('DROP TABLE IF EXISTS verification');
  await run('DROP TABLE IF EXISTS account');
  await run('DROP TABLE IF EXISTS project_members');
  await run('DROP TABLE IF EXISTS projects');
  await run('DROP TABLE IF EXISTS session');
  await run('DROP TABLE IF EXISTS user');

  // Create tables
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
    CREATE TABLE account (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      accountId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      accessToken TEXT,
      refreshToken TEXT,
      accessTokenExpiresAt INTEGER,
      refreshTokenExpiresAt INTEGER,
      scope TEXT,
      idToken TEXT,
      password TEXT,
      createdAt INTEGER DEFAULT (unixepoch()),
      updatedAt INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY(userId) REFERENCES user(id) ON DELETE CASCADE
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

  await run(`
    CREATE TABLE verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER DEFAULT (unixepoch()),
      updatedAt INTEGER DEFAULT (unixepoch())
    )
  `);

  await run(`
    CREATE TABLE twoFactor (
      id TEXT PRIMARY KEY,
      secret TEXT NOT NULL,
      backupCodes TEXT NOT NULL,
      userId TEXT NOT NULL,
      createdAt INTEGER DEFAULT (unixepoch()),
      updatedAt INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY(userId) REFERENCES user(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE subscriptions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      stripeCustomerId TEXT UNIQUE,
      stripeSubscriptionId TEXT UNIQUE,
      tier TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      currentPeriodStart INTEGER,
      currentPeriodEnd INTEGER,
      cancelAtPeriodEnd INTEGER DEFAULT 0,
      createdAt INTEGER DEFAULT (unixepoch()),
      updatedAt INTEGER DEFAULT (unixepoch()),
      UNIQUE(userId),
      FOREIGN KEY(userId) REFERENCES user(id) ON DELETE CASCADE
    )
  `);
}

/**
 * Seed a user into the test database
 */
export async function seedUser({
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

/**
 * Seed a project into the test database
 */
export async function seedProject({
  id,
  name,
  description = null,
  createdBy,
  createdAt,
  updatedAt,
}) {
  await env.DB.prepare(
    `INSERT INTO projects (id, name, description, createdBy, createdAt, updatedAt)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  )
    .bind(id, name, description, createdBy, createdAt, updatedAt)
    .run();
}

/**
 * Seed a project member into the test database
 */
export async function seedProjectMember({ id, projectId, userId, role = 'member', joinedAt }) {
  await env.DB.prepare(
    `INSERT INTO project_members (id, projectId, userId, role, joinedAt)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  )
    .bind(id, projectId, userId, role, joinedAt)
    .run();
}

/**
 * Seed a session into the test database
 */
export async function seedSession({ id, token, userId, expiresAt, createdAt, updatedAt }) {
  await env.DB.prepare(
    `INSERT INTO session (id, token, userId, expiresAt, createdAt, updatedAt)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  )
    .bind(id, token, userId, expiresAt, createdAt, updatedAt)
    .run();
}

/**
 * Seed a subscription into the test database
 */
export async function seedSubscription({
  id,
  userId,
  tier = 'free',
  status = 'active',
  stripeCustomerId = null,
  stripeSubscriptionId = null,
  currentPeriodStart = null,
  currentPeriodEnd = null,
  cancelAtPeriodEnd = 0,
  createdAt,
  updatedAt,
}) {
  await env.DB.prepare(
    `INSERT INTO subscriptions (
      id, userId, tier, status, stripeCustomerId, stripeSubscriptionId,
      currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, createdAt, updatedAt
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
  )
    .bind(
      id,
      userId,
      tier,
      status,
      stripeCustomerId,
      stripeSubscriptionId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      createdAt,
      updatedAt,
    )
    .run();
}

/**
 * Create a test environment with mocked bindings
 */
export function createTestEnv(overrides = {}) {
  const mockR2 = {
    list: async () => ({ objects: [], truncated: false }),
    get: async () => null,
    put: async () => ({ key: 'test-key' }),
    delete: async () => {},
  };

  const mockDO = {
    idFromName: name => ({ toString: () => `do-${name}` }),
    get: _id => ({
      fetch: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    }),
  };

  return {
    DB: env.DB,
    PDF_BUCKET: mockR2,
    PROJECT_DOC: mockDO,
    USER_SESSION: mockDO,
    EMAIL_QUEUE: mockDO,
    RATE_LIMIT_KV: {
      get: async () => null,
      put: async () => {},
    },
    ENVIRONMENT: 'test',
    ...overrides,
  };
}

/**
 * Parse JSON response or return raw text
 */
export async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

/**
 * Make a request to a Hono app with test environment
 */
export async function fetchApp(app, path, init = {}) {
  const testEnv = createTestEnv();
  const ctx = createExecutionContext();
  const req = new Request(`http://localhost${path}`, init);
  const res = await app.fetch(req, testEnv, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

/**
 * Create auth headers for testing
 */
export function createAuthHeaders(userId = 'test-user', email = 'test@example.com') {
  // In real tests, we'd use Better Auth's session creation
  // For now, we'll mock the auth middleware
  return {
    'x-test-user-id': userId,
    'x-test-user-email': email,
  };
}
