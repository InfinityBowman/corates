/**
 * Shared test utilities for workers tests
 */

import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  runInDurableObject,
} from 'cloudflare:test';
import { createDb } from '../db/client.js';
import {
  user,
  projects,
  projectMembers,
  session,
  subscription,
  organization,
  member,
  mediaFiles,
  projectInvitations,
  stripeEventLedger,
} from '../db/schema.js';
import {
  seedUserSchema,
  seedProjectSchema,
  seedProjectMemberSchema,
  seedSessionSchema,
  seedSubscriptionSchema,
  seedOrganizationSchema,
  seedOrgMemberSchema,
  seedMediaFileSchema,
  seedProjectInvitationSchema,
  seedStripeEventLedgerSchema,
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
 * Get the project-scoped DO name for a project
 * @param {string} projectId - Project ID
 * @returns {string} The DO instance name in format "project:${projectId}"
 */
export function getProjectDocName(projectId) {
  return `project:${projectId}`;
}

/**
 * Clear ProjectDoc Durable Objects for test projects
 * This prevents DO invalidation errors between tests
 * @param {Array<string>} projectIds - Array of project IDs
 */
export async function clearProjectDOs(projectIds = []) {
  // Common test project IDs that might have DOs
  const defaultProjectIds = ['project-1', 'project-2', 'p1', 'p2'];
  const allProjectIds = [...defaultProjectIds, ...projectIds];

  for (const projectId of allProjectIds) {
    try {
      const doName = getProjectDocName(projectId);
      const doId = env.PROJECT_DOC.idFromName(doName);
      const stub = env.PROJECT_DOC.get(doId);
      await runInDurableObject(stub, async (instance, state) => {
        // Clear all storage
        const keys = await state.storage.list();
        for (const [key] of keys) {
          await state.storage.delete(key);
        }
      });
    } catch (error) {
      // Ignore errors - DO might not exist or be invalid
      // This is expected when DOs are invalidated between test runs
      const isInvalidationError =
        error?.message?.includes('invalidating this Durable Object') ||
        error?.message?.includes('inputGateBroken') ||
        error?.remote === true ||
        error?.durableObjectReset === true;
      if (!isInvalidationError) {
        // Only log non-invalidation errors for debugging
        console.warn(`Failed to clear ProjectDoc DO for ${projectId}:`, error.message);
      }
    }
  }
}

/**
 * Reset database schema for tests using Drizzle migrations
 * This function safely drops all tables and recreates the schema from migrations
 */
export async function resetTestDatabase() {
  const run = sql => env.DB.prepare(sql).run();

  // Disable foreign keys before dropping to avoid constraint errors
  await run('PRAGMA foreign_keys = OFF');

  // Drop tables in reverse dependency order (child tables first, then parent tables)
  // This order matches the reverse of table creation order in migrations
  // Wrap each drop in try-catch to handle cases where tables don't exist
  const tablesToDrop = [
    'project_invitations',
    'org_access_grants',
    'stripe_event_ledger',
    'subscription',
    'twoFactor',
    'verification',
    'mediaFiles',
    'project_members',
    'projects',
    'invitation',
    'member',
    'session',
    'account',
    'organization',
    'user',
  ];

  for (const table of tablesToDrop) {
    try {
      await run(`DROP TABLE IF EXISTS \`${table}\``);
    } catch (error) {
      // Ignore "no such table" errors - table might not exist
      // Re-throw other errors as they indicate real problems
      if (!error.message?.includes('no such table')) {
        throw error;
      }
    }
  }

  // Re-enable foreign keys after dropping tables
  await run('PRAGMA foreign_keys = ON');

  // Parse and execute the migration SQL
  const statements = parseSqlStatements(MIGRATION_SQL);

  // Execute each migration statement
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await run(statement);
      } catch (error) {
        // Ignore "table already exists" errors during creation
        // This can happen if a previous test run didn't clean up properly
        if (error.message?.includes('already exists')) {
          // Table exists, skip creation
          continue;
        }
        throw error;
      }
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
    stripeCustomerId: validated.stripeCustomerId,
    createdAt: new Date(validated.createdAt * 1000),
    updatedAt: new Date(validated.updatedAt * 1000),
  });
}

/**
 * Seed an organization into the test database
 */
export async function seedOrganization(params) {
  const validated = seedOrganizationSchema.parse(params);
  const db = createDb(env.DB);

  await db.insert(organization).values({
    id: validated.id,
    name: validated.name,
    slug: validated.slug,
    logo: validated.logo,
    metadata: validated.metadata,
    createdAt: new Date(validated.createdAt * 1000),
  });
}

/**
 * Seed an organization member into the test database
 */
export async function seedOrgMember(params) {
  const validated = seedOrgMemberSchema.parse(params);
  const db = createDb(env.DB);

  await db.insert(member).values({
    id: validated.id,
    userId: validated.userId,
    organizationId: validated.organizationId,
    role: validated.role,
    createdAt: new Date(validated.createdAt * 1000),
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
    orgId: validated.orgId,
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

  await db.insert(subscription).values({
    id: validated.id,
    plan: validated.plan,
    referenceId: validated.referenceId,
    status: validated.status,
    stripeCustomerId: validated.stripeCustomerId,
    stripeSubscriptionId: validated.stripeSubscriptionId,
    periodStart: validated.periodStart ? new Date(validated.periodStart * 1000) : null,
    periodEnd: validated.periodEnd ? new Date(validated.periodEnd * 1000) : null,
    cancelAtPeriodEnd: validated.cancelAtPeriodEnd === 1,
    cancelAt: validated.cancelAt ? new Date(validated.cancelAt * 1000) : null,
    canceledAt: validated.canceledAt ? new Date(validated.canceledAt * 1000) : null,
    endedAt: validated.endedAt ? new Date(validated.endedAt * 1000) : null,
    seats: validated.seats,
    trialStart: validated.trialStart ? new Date(validated.trialStart * 1000) : null,
    trialEnd: validated.trialEnd ? new Date(validated.trialEnd * 1000) : null,
    createdAt: new Date(validated.createdAt * 1000),
    updatedAt: new Date(validated.updatedAt * 1000),
  });
}

/**
 * Seed a media file into the test database
 */
export async function seedMediaFile(params) {
  const validated = seedMediaFileSchema.parse(params);
  const db = createDb(env.DB);

  await db.insert(mediaFiles).values({
    id: validated.id,
    filename: validated.filename,
    originalName: validated.originalName,
    fileType: validated.fileType,
    fileSize: validated.fileSize,
    uploadedBy: validated.uploadedBy,
    bucketKey: validated.bucketKey,
    createdAt: new Date(validated.createdAt * 1000),
  });
}

/**
 * Seed a project invitation into the test database
 */
export async function seedProjectInvitation(params) {
  const validated = seedProjectInvitationSchema.parse(params);
  const db = createDb(env.DB);

  await db.insert(projectInvitations).values({
    id: validated.id,
    orgId: validated.orgId,
    projectId: validated.projectId,
    email: validated.email.toLowerCase(),
    role: validated.role,
    orgRole: validated.orgRole,
    grantOrgMembership: validated.grantOrgMembership === 1,
    token: validated.token,
    invitedBy: validated.invitedBy,
    expiresAt: new Date(validated.expiresAt * 1000),
    acceptedAt: validated.acceptedAt ? new Date(validated.acceptedAt * 1000) : null,
    createdAt: new Date(validated.createdAt * 1000),
  });
}

/**
 * Seed a Stripe event ledger entry into the test database
 */
export async function seedStripeEventLedger(params) {
  const validated = seedStripeEventLedgerSchema.parse(params);
  const db = createDb(env.DB);

  await db.insert(stripeEventLedger).values({
    id: validated.id,
    payloadHash: validated.payloadHash,
    signaturePresent: validated.signaturePresent === 1,
    receivedAt: new Date(validated.receivedAt * 1000),
    route: validated.route,
    requestId: validated.requestId,
    status: validated.status,
    error: validated.error,
    httpStatus: validated.httpStatus,
    stripeEventId: validated.stripeEventId,
    type: validated.type,
    livemode:
      validated.livemode === 1 ? true
      : validated.livemode === 0 ? false
      : null,
    apiVersion: validated.apiVersion,
    created: validated.created ? new Date(validated.created * 1000) : null,
    processedAt: validated.processedAt ? new Date(validated.processedAt * 1000) : null,
    orgId: validated.orgId,
    stripeCustomerId: validated.stripeCustomerId,
    stripeSubscriptionId: validated.stripeSubscriptionId,
    stripeCheckoutSessionId: validated.stripeCheckoutSessionId,
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
