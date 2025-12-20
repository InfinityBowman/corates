/**
 * Shared test utilities for workers tests
 */

import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { createDb } from '../db/client.js';
import { user, projects, projectMembers, session, subscriptions } from '../db/schema.js';
import {
  seedUserSchema,
  seedProjectSchema,
  seedProjectMemberSchema,
  seedSessionSchema,
  seedSubscriptionSchema,
} from './seed-schemas.js';
import { MIGRATION_SQL } from './migration-sql.js';

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
export async function seedUser(params) {
  const validated = seedUserSchema.parse(params);
  const db = createDb(env.DB);

  await db.insert(user).values({
    id: validated.id,
    name: validated.name,
    email: validated.email,
    displayName: validated.displayName,
    username: validated.username,
    role: validated.role,
    emailVerified: validated.emailVerified === 1,
    banned: validated.banned === 1,
    banReason: validated.banReason,
    banExpires: validated.banExpires ? new Date(validated.banExpires * 1000) : null,
    createdAt: new Date(validated.createdAt * 1000),
    updatedAt: new Date(validated.updatedAt * 1000),
  });
}

/**
 * Seed a project into the test database
 */
export async function seedProject(params) {
  const validated = seedProjectSchema.parse(params);
  const db = createDb(env.DB);

  await db.insert(projects).values({
    id: validated.id,
    name: validated.name,
    description: validated.description,
    createdBy: validated.createdBy,
    createdAt: new Date(validated.createdAt * 1000),
    updatedAt: new Date(validated.updatedAt * 1000),
  });
}

/**
 * Seed a project member into the test database
 */
export async function seedProjectMember(params) {
  const validated = seedProjectMemberSchema.parse(params);
  const db = createDb(env.DB);

  await db.insert(projectMembers).values({
    id: validated.id,
    projectId: validated.projectId,
    userId: validated.userId,
    role: validated.role,
    joinedAt: new Date(validated.joinedAt * 1000),
  });
}

/**
 * Seed a session into the test database
 */
export async function seedSession(params) {
  const validated = seedSessionSchema.parse(params);
  const db = createDb(env.DB);

  await db.insert(session).values({
    id: validated.id,
    token: validated.token,
    userId: validated.userId,
    expiresAt: new Date(validated.expiresAt * 1000),
    createdAt: new Date(validated.createdAt * 1000),
    updatedAt: new Date(validated.updatedAt * 1000),
  });
}

/**
 * Seed a subscription into the test database
 */
export async function seedSubscription(params) {
  const validated = seedSubscriptionSchema.parse(params);
  const db = createDb(env.DB);

  await db.insert(subscriptions).values({
    id: validated.id,
    userId: validated.userId,
    tier: validated.tier,
    status: validated.status,
    stripeCustomerId: validated.stripeCustomerId,
    stripeSubscriptionId: validated.stripeSubscriptionId,
    currentPeriodStart:
      validated.currentPeriodStart ? new Date(validated.currentPeriodStart * 1000) : null,
    currentPeriodEnd:
      validated.currentPeriodEnd ? new Date(validated.currentPeriodEnd * 1000) : null,
    cancelAtPeriodEnd: validated.cancelAtPeriodEnd === 1,
    createdAt: new Date(validated.createdAt * 1000),
    updatedAt: new Date(validated.updatedAt * 1000),
  });
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
