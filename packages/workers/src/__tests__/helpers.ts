import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  runInDurableObject,
} from 'cloudflare:test';
import { createDb } from '@/db/client.js';
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
} from '@/db/schema.js';
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
import type {
  SeedUserInput,
  SeedOrganizationInput,
  SeedOrgMemberInput,
  SeedProjectInput,
  SeedProjectMemberInput,
  SeedSessionInput,
  SeedSubscriptionInput,
  SeedMediaFileInput,
  SeedProjectInvitationInput,
  SeedStripeEventLedgerInput,
} from './seed-schemas.js';
import { MIGRATION_SQL } from './migration-sql.js';

function parseSqlStatements(sqlContent: string): string[] {
  const withoutComments = sqlContent.replace(/--.*$/gm, '');

  const statements: string[] = [];
  let currentStatement = '';
  let inString = false;
  let stringChar: string | null = null;

  for (let i = 0; i < withoutComments.length; i++) {
    const char = withoutComments[i];

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

    if (char === ';' && !inString) {
      const trimmed = currentStatement.trim();
      if (trimmed && trimmed !== ';') {
        statements.push(trimmed);
      }
      currentStatement = '';
    }
  }

  const trimmed = currentStatement.trim();
  if (trimmed) {
    statements.push(trimmed);
  }

  return statements.filter(stmt => stmt.length > 0);
}

export function getProjectDocName(projectId: string): string {
  return `project:${projectId}`;
}

export async function clearProjectDOs(projectIds: string[] = []): Promise<void> {
  const defaultProjectIds = ['project-1', 'project-2', 'p1', 'p2'];
  const allProjectIds = [...defaultProjectIds, ...projectIds];

  for (const projectId of allProjectIds) {
    try {
      const doName = getProjectDocName(projectId);
      const doId = env.PROJECT_DOC.idFromName(doName);
      const stub = env.PROJECT_DOC.get(doId);
      await runInDurableObject(stub, async (_instance, state) => {
        const keys = await state.storage.list();
        for (const [key] of keys) {
          await state.storage.delete(key);
        }
      });
    } catch (err: unknown) {
      // Ignore DO invalidation errors between test runs
      const error = err as { message?: string; remote?: boolean; durableObjectReset?: boolean };
      const isInvalidationError =
        error?.message?.includes('invalidating this Durable Object') ||
        error?.message?.includes('inputGateBroken') ||
        error?.remote === true ||
        error?.durableObjectReset === true;
      if (!isInvalidationError) {
        console.warn(`Failed to clear ProjectDoc DO for ${projectId}:`, error?.message);
      }
    }
  }
}

export async function resetTestDatabase(): Promise<void> {
  const run = (sql: string) => env.DB.prepare(sql).run();

  await run('PRAGMA foreign_keys = OFF');

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
    } catch (err: unknown) {
      if (!(err instanceof Error) || !err.message?.includes('no such table')) {
        throw err;
      }
    }
  }

  await run('PRAGMA foreign_keys = ON');

  const statements = parseSqlStatements(MIGRATION_SQL);

  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await run(statement);
      } catch (err: unknown) {
        if (err instanceof Error && err.message?.includes('already exists')) {
          continue;
        }
        throw err;
      }
    }
  }
}

export async function seedUser(params: SeedUserInput): Promise<void> {
  const validated = seedUserSchema.parse(params);
  const db = createDb(env.DB);

  await db.insert(user).values({
    id: validated.id,
    name: validated.name,
    email: validated.email,
    givenName: validated.givenName,
    familyName: validated.familyName,
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

export async function seedOrganization(params: SeedOrganizationInput): Promise<void> {
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

export async function seedOrgMember(params: SeedOrgMemberInput): Promise<void> {
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

export async function seedProject(params: SeedProjectInput): Promise<void> {
  const validated = seedProjectSchema.parse(params);
  const db = createDb(env.DB);

  await db.insert(projects).values({
    id: validated.id,
    name: validated.name,
    description: validated.description,
    orgId: validated.orgId!,
    createdBy: validated.createdBy,
    createdAt: new Date(validated.createdAt * 1000),
    updatedAt: new Date(validated.updatedAt * 1000),
  });
}

export async function seedProjectMember(params: SeedProjectMemberInput): Promise<void> {
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

export async function seedSession(params: SeedSessionInput): Promise<void> {
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

export async function seedSubscription(params: SeedSubscriptionInput): Promise<void> {
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

export async function seedMediaFile(params: SeedMediaFileInput): Promise<void> {
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
    orgId: validated.orgId,
    projectId: validated.projectId,
    studyId: validated.studyId,
    createdAt: new Date(validated.createdAt * 1000),
  });
}

export async function seedProjectInvitation(params: SeedProjectInvitationInput): Promise<void> {
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

export async function seedStripeEventLedger(params: SeedStripeEventLedgerInput): Promise<void> {
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

export function createTestEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const mockR2 = {
    list: async () => ({ objects: [], truncated: false }),
    get: async () => null,
    put: async () => ({ key: 'test-key' }),
    delete: async () => {},
  };

  const mockDO = {
    idFromName: (name: string) => ({ toString: () => `do-${name}` }),
    get: (_id: unknown) => ({
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

export async function json(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

interface FetchableApp {
  fetch(_req: Request, _env: Record<string, unknown>, _ctx: ExecutionContext): Promise<Response>;
}

export async function fetchApp(
  app: FetchableApp,
  path: string,
  init: Record<string, unknown> = {},
  envOverrides: Record<string, unknown> = {},
): Promise<Response> {
  const testEnv = createTestEnv(envOverrides);
  const ctx = createExecutionContext();
  const req = new Request(`http://localhost${path}`, init);
  const res = await app.fetch(req, testEnv, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

export function createAuthHeaders(
  userId = 'test-user',
  email = 'test@example.com',
): Record<string, string> {
  return {
    'x-test-user-id': userId,
    'x-test-user-email': email,
  };
}
