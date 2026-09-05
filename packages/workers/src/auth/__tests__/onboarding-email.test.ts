import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:workers';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, organization } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { createDb } from '@corates/db/client';
import * as schema from '@corates/db/schema';
import { makeSyntheticEmail } from '@corates/shared/email';
import type { OrgId, UserId } from '@corates/shared/ids';
import { resetTestDatabase } from '../../__tests__/helpers';
import { onboardingEmail } from '../onboarding-email';

const CODE = '123456';
const PASSWORD = 'password-long-enough';

function cookieHeader(headers: Headers): Headers {
  const cookies = headers
    .getSetCookie()
    .map(c => c.split(';')[0])
    .join('; ');
  return new Headers({ cookie: cookies });
}

function createAuth(canDiscardUser?: (userId: string) => Promise<boolean>) {
  const db = createDb(env.DB);
  const sent: Array<{ email: string; code: string }> = [];
  const auth = betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        organization: schema.organization,
        member: schema.member,
        invitation: schema.invitation,
      },
    }),
    secret: 'test-secret-that-is-long-enough-for-better-auth',
    baseURL: 'http://localhost:3000',
    emailAndPassword: { enabled: true },
    user: { additionalFields: { profileCompletedAt: { type: 'number', required: false } } },
    plugins: [
      organization(),
      admin(),
      onboardingEmail({
        db,
        sendCode: async ({ email, code }) => {
          sent.push({ email, code });
        },
        generateCode: () => CODE,
        canDiscardUser,
      }),
    ],
  });
  return { auth, db, sent };
}

type Auth = ReturnType<typeof createAuth>['auth'];
type Db = ReturnType<typeof createAuth>['db'];

async function signUp(auth: Auth, email: string) {
  const { headers, response } = await auth.api.signUpEmail({
    body: { email, password: PASSWORD, name: email.split('@')[0] },
    returnHeaders: true,
  });
  return { userId: response.user.id as UserId, headers: cookieHeader(headers) };
}

async function errorCode(
  auth: Auth,
  path: string,
  body: Record<string, string>,
  headers: Headers,
): Promise<string | undefined> {
  const res = await auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        cookie: headers.get('cookie') ?? '',
      },
      body: JSON.stringify(body),
    }),
  );
  if (res.ok) return undefined;
  return ((await res.json()) as { code?: string }).code;
}

async function findUser(db: Db, id: UserId) {
  return db.select().from(schema.user).where(eq(schema.user.id, id)).get();
}

async function accountsOf(db: Db, id: UserId) {
  return db.select().from(schema.account).where(eq(schema.account.userId, id));
}

describe('onboardingEmail plugin', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('writes a new address as verified after the code checks out', async () => {
    const { auth, db, sent } = createAuth();
    const orphan = await signUp(auth, makeSyntheticEmail('0000-0001'));

    await auth.api.requestOnboardingEmail({
      body: { email: 'Real@Example.org' },
      headers: orphan.headers,
    });
    expect(sent).toEqual([{ email: 'real@example.org', code: CODE }]);

    const result = await auth.api.confirmOnboardingEmail({
      body: { email: 'real@example.org', code: CODE },
      headers: orphan.headers,
    });
    expect(result).toEqual({ claimed: false });

    const session = await auth.api.getSession({ headers: orphan.headers });
    expect(session?.user.email).toBe('real@example.org');
    expect(session?.user.emailVerified).toBe(true);
    expect(await db.select().from(schema.verification)).toHaveLength(0);
  });

  it('rejects wrong codes and locks out after too many attempts', async () => {
    const { auth } = createAuth();
    const orphan = await signUp(auth, makeSyntheticEmail('0000-0002'));
    await auth.api.requestOnboardingEmail({
      body: { email: 'real@example.org' },
      headers: orphan.headers,
    });

    for (let i = 0; i < 5; i++) {
      const code = await errorCode(
        auth,
        '/onboarding/confirm-email',
        { email: 'real@example.org', code: '000000' },
        orphan.headers,
      );
      expect(code).toBe('CODE_INVALID');
    }
    const locked = await errorCode(
      auth,
      '/onboarding/confirm-email',
      { email: 'real@example.org', code: CODE },
      orphan.headers,
    );
    expect(locked).toBe('TOO_MANY_ATTEMPTS');
  });

  it('refuses users that already have a verified real email', async () => {
    const { auth, db } = createAuth();
    const user = await signUp(auth, 'settled@example.org');
    await db
      .update(schema.user)
      .set({ emailVerified: true })
      .where(eq(schema.user.id, user.userId));

    const code = await errorCode(
      auth,
      '/onboarding/request-email',
      { email: 'other@example.org' },
      user.headers,
    );
    expect(code).toBe('NOT_ELIGIBLE');
  });

  it('claims the existing account: moves accounts, drops the orphan and its workspace, switches session', async () => {
    const { auth, db, sent } = createAuth();
    const existing = await signUp(auth, 'owner@example.org');
    const orphan = await signUp(auth, makeSyntheticEmail('0000-0003'));
    await auth.api.createOrganization({
      body: { name: 'Orphan Workspace', slug: 'orphan-workspace' },
      headers: orphan.headers,
    });
    expect(await db.select().from(schema.organization)).toHaveLength(1);

    await auth.api.requestOnboardingEmail({
      body: { email: 'owner@example.org' },
      headers: orphan.headers,
    });
    // The taken address still gets a code so the response reveals nothing
    expect(sent).toEqual([{ email: 'owner@example.org', code: CODE }]);

    const { headers, response } = await auth.api.confirmOnboardingEmail({
      body: { email: 'owner@example.org', code: CODE },
      headers: orphan.headers,
      returnHeaders: true,
    });
    expect(response).toEqual({ claimed: true });

    expect(await findUser(db, orphan.userId)).toBeUndefined();
    expect(await db.select().from(schema.organization)).toHaveLength(0);
    expect(await db.select().from(schema.member)).toHaveLength(0);
    // The unverified owner row's own password went with its unproven access;
    // only the orphan's moved account remains
    const accounts = await accountsOf(db, existing.userId);
    expect(accounts).toHaveLength(1);
    expect(await db.select().from(schema.account)).toHaveLength(1);

    // Sessions the owner row held before ownership was proven are gone
    expect(await auth.api.getSession({ headers: existing.headers })).toBeNull();
    const session = await auth.api.getSession({ headers: cookieHeader(headers) });
    expect(session?.user.id).toBe(existing.userId);
    expect(session?.user.emailVerified).toBe(true);
  });

  it('moves memberships in shared workspaces onto the claimed account', async () => {
    const { auth, db } = createAuth();
    const host = await signUp(auth, 'host@example.org');
    const org = await auth.api.createOrganization({
      body: { name: 'Host Lab', slug: 'host-lab' },
      headers: host.headers,
    });
    const orgId = org!.id as OrgId;
    const existing = await signUp(auth, 'owner@example.org');
    const orphan = await signUp(auth, makeSyntheticEmail('0000-0006'));
    await db.insert(schema.member).values({
      id: 'member-orphan' as never,
      userId: orphan.userId,
      organizationId: orgId,
      role: 'member',
    });

    await auth.api.requestOnboardingEmail({
      body: { email: 'owner@example.org' },
      headers: orphan.headers,
    });
    await auth.api.confirmOnboardingEmail({
      body: { email: 'owner@example.org', code: CODE },
      headers: orphan.headers,
    });

    const members = await db
      .select({ userId: schema.member.userId })
      .from(schema.member)
      .where(eq(schema.member.organizationId, orgId));
    expect(members.map(m => m.userId).sort()).toEqual([existing.userId, host.userId].sort());
    expect(await findUser(db, orphan.userId)).toBeUndefined();
  });

  it('refuses to claim a banned account before anything moves', async () => {
    const { auth, db } = createAuth();
    const existing = await signUp(auth, 'owner@example.org');
    await db.update(schema.user).set({ banned: true }).where(eq(schema.user.id, existing.userId));
    const orphan = await signUp(auth, makeSyntheticEmail('0000-0007'));

    await auth.api.requestOnboardingEmail({
      body: { email: 'owner@example.org' },
      headers: orphan.headers,
    });
    const code = await errorCode(
      auth,
      '/onboarding/confirm-email',
      { email: 'owner@example.org', code: CODE },
      orphan.headers,
    );
    expect(code).toBe('BANNED_USER');
    expect(await findUser(db, orphan.userId)).toBeDefined();
    expect(await accountsOf(db, orphan.userId)).toHaveLength(1);
  });

  it('keeps a user with a completed profile and reports the address as in use', async () => {
    const { auth, db } = createAuth();
    await signUp(auth, 'owner@example.org');
    const orphan = await signUp(auth, makeSyntheticEmail('0000-0004'));
    await db
      .update(schema.user)
      .set({ profileCompletedAt: 1 })
      .where(eq(schema.user.id, orphan.userId));

    await auth.api.requestOnboardingEmail({
      body: { email: 'owner@example.org' },
      headers: orphan.headers,
    });
    const code = await errorCode(
      auth,
      '/onboarding/confirm-email',
      { email: 'owner@example.org', code: CODE },
      orphan.headers,
    );
    expect(code).toBe('EMAIL_IN_USE');
    expect(await findUser(db, orphan.userId)).toBeDefined();
  });

  it('lets the host veto discarding a user that owns data', async () => {
    const { auth } = createAuth(async () => false);
    await signUp(auth, 'owner@example.org');
    const orphan = await signUp(auth, makeSyntheticEmail('0000-0005'));

    await auth.api.requestOnboardingEmail({
      body: { email: 'owner@example.org' },
      headers: orphan.headers,
    });
    const code = await errorCode(
      auth,
      '/onboarding/confirm-email',
      { email: 'owner@example.org', code: CODE },
      orphan.headers,
    );
    expect(code).toBe('EMAIL_IN_USE');
  });
});
