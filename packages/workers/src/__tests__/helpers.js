/**
 * Shared test utilities for workers tests
 */

import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';

// Migration SQL content - should be kept in sync with packages/workers/migrations/0001_init.sql
// This is embedded here because Cloudflare Workers test environment doesn't support
// reading files from the local file system at runtime
const MIGRATION_SQL = `-- Consolidated Corates Database Schema
-- Run: wrangler d1 migrations apply corates-db --local

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS mediaFiles;
DROP TABLE IF EXISTS project_members;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS email_verification_tokens;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS auth_accounts;
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS verification;
DROP TABLE IF EXISTS account;
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS user;
DROP TABLE IF EXISTS twoFactor;

-- Better Auth user table
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
  role TEXT, -- Better Auth admin/plugin role (e.g. 'user', 'admin')
  persona TEXT, -- optional: researcher, student, librarian, other
  profileCompletedAt INTEGER, -- unix timestamp (seconds)
  twoFactorEnabled INTEGER DEFAULT 0,
  -- Admin plugin fields
  banned INTEGER DEFAULT 0,
  banReason TEXT,
  banExpires INTEGER
);

-- Better Auth session table
CREATE TABLE session (
  id TEXT PRIMARY KEY,
  expiresAt INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  createdAt INTEGER DEFAULT (unixepoch()),
  updatedAt INTEGER DEFAULT (unixepoch()),
  ipAddress TEXT,
  userAgent TEXT,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  impersonatedBy TEXT REFERENCES user(id) ON DELETE SET NULL
);

-- Better Auth account table (for OAuth and password)
CREATE TABLE account (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt INTEGER,
  refreshTokenExpiresAt INTEGER,
  scope TEXT,
  password TEXT, -- For email/password auth
  createdAt INTEGER DEFAULT (unixepoch()),
  updatedAt INTEGER DEFAULT (unixepoch()),
  unlinkedAt INTEGER DEFAULT NULL -- For soft-delete grace period on unlink
);

-- Better Auth verification table
CREATE TABLE verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER DEFAULT (unixepoch()),
  updatedAt INTEGER DEFAULT (unixepoch())
);

-- Better Auth two-factor table
CREATE TABLE twoFactor (
  id TEXT PRIMARY KEY,
  secret TEXT NOT NULL,
  backupCodes TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  createdAt INTEGER DEFAULT (unixepoch()),
  updatedAt INTEGER DEFAULT (unixepoch())
);

-- Projects table (for user's research projects)
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  createdBy TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  createdAt INTEGER DEFAULT (unixepoch()),
  updatedAt INTEGER DEFAULT (unixepoch())
);

-- Project membership table (which users have access to which projects)
CREATE TABLE project_members (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- owner, collaborator, member, viewer
  joinedAt INTEGER DEFAULT (unixepoch()),

  -- Ensure unique user-project combinations
  UNIQUE(projectId, userId)
);

-- Subscriptions table (Stripe billing)
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  stripeCustomerId TEXT UNIQUE,
  stripeSubscriptionId TEXT UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free', -- 'free', 'pro', 'team', 'enterprise'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'trialing', 'incomplete'
  currentPeriodStart INTEGER,
  currentPeriodEnd INTEGER,
  cancelAtPeriodEnd INTEGER DEFAULT 0,
  createdAt INTEGER DEFAULT (unixepoch()),
  updatedAt INTEGER DEFAULT (unixepoch()),

  UNIQUE(userId)
);

-- Media files table (for uploaded files stored in R2)
CREATE TABLE mediaFiles (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  originalName TEXT,
  fileType TEXT,
  fileSize INTEGER,
  uploadedBy TEXT REFERENCES user(id),
  bucketKey TEXT NOT NULL,
  createdAt INTEGER DEFAULT (unixepoch())
);

-- Create indexes for better performance

-- Auth indexes
CREATE INDEX idx_session_userId ON session(userId);
CREATE INDEX idx_session_token ON session(token);
CREATE INDEX idx_account_userId ON account(userId);
CREATE INDEX idx_account_providerId ON account(providerId);
CREATE INDEX idx_verification_identifier ON verification(identifier);

-- Two-factor indexes
CREATE INDEX idx_twoFactor_userId ON twoFactor(userId);

-- Project indexes
CREATE INDEX idx_projects_createdBy ON projects(createdBy);
CREATE INDEX idx_projects_createdAt ON projects(createdAt);
CREATE INDEX idx_project_members_projectId ON project_members(projectId);
CREATE INDEX idx_project_members_userId ON project_members(userId);

-- Subscription indexes
CREATE INDEX idx_subscriptions_userId ON subscriptions(userId);
CREATE INDEX idx_subscriptions_stripeCustomerId ON subscriptions(stripeCustomerId);
CREATE INDEX idx_subscriptions_stripeSubscriptionId ON subscriptions(stripeSubscriptionId);`;

/**
 * Parse SQL file into individual statements, handling comments and multi-line statements
 */
function parseSqlStatements(sqlContent) {
  // Remove single-line comments (-- ...)
  const withoutComments = sqlContent.replace(/--.*$/gm, '');

  // Split by semicolons, but keep statements that span multiple lines
  const statements = [];
  let currentStatement = '';
  let inString = false;
  let stringChar = null;

  for (let i = 0; i < withoutComments.length; i++) {
    const char = withoutComments[i];
    const nextChar = withoutComments[i + 1];

    // Track string boundaries
    if ((char === "'" || char === '"') && (i === 0 || withoutComments[i - 1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = null;
      }
    }

    currentStatement += char;

    // If we hit a semicolon outside of a string, we have a complete statement
    if (char === ';' && !inString) {
      const trimmed = currentStatement.trim();
      if (trimmed && trimmed !== ';') {
        statements.push(trimmed);
      }
      currentStatement = '';
    }
  }

  // Add any remaining statement (though migration file should end with semicolon)
  const trimmed = currentStatement.trim();
  if (trimmed) {
    statements.push(trimmed);
  }

  return statements.filter(stmt => stmt.length > 0);
}

/**
 * Reset database schema for tests using Drizzle migrations
 */
export async function resetTestDatabase() {
  const run = sql => env.DB.prepare(sql).run();

  // Enable foreign keys
  await run('PRAGMA foreign_keys = ON');

  // Parse and execute the migration SQL
  const statements = parseSqlStatements(MIGRATION_SQL);

  // Execute each migration statement
  for (const statement of statements) {
    if (statement.trim()) {
      await run(statement);
    }
  }
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
    POSTMARK_SERVER_TOKEN: 'test-token',
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
export async function fetchApp(app, path, init = {}, envOverrides = {}) {
  const testEnv = createTestEnv(envOverrides);
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
