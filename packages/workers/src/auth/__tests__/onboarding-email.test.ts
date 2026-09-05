import { describe, it, expect, beforeEach } from 'vitest';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { organization } from 'better-auth/plugins';
import { makeSyntheticEmail } from '@corates/shared/email';
import { onboardingEmail } from '../onboarding-email';

type Row = Record<string, unknown>;
type MemoryDb = Record<string, Row[]>;

const CODE = '123456';
const PASSWORD = 'password-long-enough';

function cookieHeader(headers: Headers): Headers {
  const cookies = headers
    .getSetCookie()
    .map(c => c.split(';')[0])
    .join('; ');
  return new Headers({ cookie: cookies });
}

function createAuth(db: MemoryDb, canDiscardUser?: (userId: string) => Promise<boolean>) {
  const sent: Array<{ email: string; code: string }> = [];
  const auth = betterAuth({
    database: memoryAdapter(db),
    secret: 'test-secret-that-is-long-enough-for-better-auth',
    baseURL: 'http://localhost:3000',
    emailAndPassword: { enabled: true },
    user: { additionalFields: { profileCompletedAt: { type: 'number', required: false } } },
    plugins: [
      organization(),
      onboardingEmail({
        sendCode: async ({ email, code }) => {
          sent.push({ email, code });
        },
        generateCode: () => CODE,
        canDiscardUser,
      }),
    ],
  });
  return { auth, sent };
}

async function signUp(auth: Auth, email: string) {
  const { headers, response } = await auth.api.signUpEmail({
    body: { email, password: PASSWORD, name: email.split('@')[0] },
    returnHeaders: true,
  });
  return { userId: response.user.id, headers: cookieHeader(headers) };
}

type Auth = ReturnType<typeof createAuth>['auth'];

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

describe('onboardingEmail plugin', () => {
  let db: MemoryDb;

  beforeEach(() => {
    db = {
      user: [],
      session: [],
      account: [],
      verification: [],
      organization: [],
      member: [],
      invitation: [],
    };
  });

  it('writes a new address as verified after the code checks out', async () => {
    const { auth, sent } = createAuth(db);
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
    expect(db.verification).toHaveLength(0);
  });

  it('rejects wrong codes and locks out after too many attempts', async () => {
    const { auth } = createAuth(db);
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
    const { auth } = createAuth(db);
    const user = await signUp(auth, 'settled@example.org');
    db.user.find(u => u.id === user.userId)!.emailVerified = true;

    const code = await errorCode(
      auth,
      '/onboarding/request-email',
      { email: 'other@example.org' },
      user.headers,
    );
    expect(code).toBe('NOT_ELIGIBLE');
  });

  it('claims the existing account: moves accounts, drops the orphan and its workspace, switches session', async () => {
    const { auth, sent } = createAuth(db);
    const existing = await signUp(auth, 'owner@example.org');
    const orphan = await signUp(auth, makeSyntheticEmail('0000-0003'));
    await auth.api.createOrganization({
      body: { name: 'Orphan Workspace', slug: 'orphan-workspace' },
      headers: orphan.headers,
    });
    expect(db.organization).toHaveLength(1);

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

    expect(db.user.find(u => u.id === orphan.userId)).toBeUndefined();
    expect(db.organization).toHaveLength(0);
    expect(db.member.filter(m => m.userId === orphan.userId)).toHaveLength(0);
    expect(db.account.every(a => a.userId === existing.userId)).toBe(true);
    expect(db.account).toHaveLength(2);

    const session = await auth.api.getSession({ headers: cookieHeader(headers) });
    expect(session?.user.id).toBe(existing.userId);
    expect(session?.user.emailVerified).toBe(true);
  });

  it('keeps a user with a completed profile and reports the address as in use', async () => {
    const { auth } = createAuth(db);
    await signUp(auth, 'owner@example.org');
    const orphan = await signUp(auth, makeSyntheticEmail('0000-0004'));
    db.user.find(u => u.id === orphan.userId)!.profileCompletedAt = 1;

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
    expect(db.user.find(u => u.id === orphan.userId)).toBeDefined();
  });

  it('lets the host veto discarding a user that owns data', async () => {
    const { auth } = createAuth(db, async () => false);
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
