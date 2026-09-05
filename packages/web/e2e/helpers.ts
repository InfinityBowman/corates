/**
 * E2E test helpers
 * Seed data, auth cookies, and cleanup via the backend test-seed endpoints
 */

import { expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { BASE_URL } from './constants';

const API_BASE = BASE_URL;

export interface SeededUser {
  id: string;
  name: string;
  email: string;
}

export interface SessionCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax' | 'Strict' | 'None';
  expires: number;
}

export interface DualReviewerScenario {
  userA: SeededUser;
  userB: SeededUser;
  orgId: string;
  cookiesA: SessionCookie[];
  cookiesB: SessionCookie[];
}

/**
 * Unique ID prefix for seeded data. Generated per call (not per module load)
 * with a random suffix so scenarios never collide -- parallel workers can
 * start within the same millisecond, and a single worker seeds multiple
 * scenarios across spec files.
 */
export function uniquePrefix(base: string): string {
  return `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function seedDualReviewerScenario(): Promise<DualReviewerScenario> {
  const prefix = uniquePrefix('e2e');
  const userAId = `${prefix}-user-a`;
  const userBId = `${prefix}-user-b`;
  const orgId = `${prefix}-org`;

  const seedRes = await fetch(`${API_BASE}/api/test/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      users: [
        {
          id: userAId,
          name: 'Alice Reviewer',
          email: `alice-${prefix}@test.corates.org`,
          givenName: 'Alice',
          familyName: 'Reviewer',
        },
        {
          id: userBId,
          name: 'Bob Reviewer',
          email: `bob-${prefix}@test.corates.org`,
          givenName: 'Bob',
          familyName: 'Reviewer',
        },
      ],
      org: { id: orgId, name: 'E2E Test Org', slug: `e2e-org-${prefix}` },
      orgMembers: [
        { userId: userAId, role: 'owner' },
        { userId: userBId, role: 'member' },
      ],
    }),
  });

  if (!seedRes.ok) {
    throw new Error(`Seed failed: ${seedRes.status} ${await seedRes.text()}`);
  }

  const seedData = await seedRes.json();

  // Get session cookies for both users
  const sessionA = await getSessionCookies(userAId);
  const sessionB = await getSessionCookies(userBId);

  return {
    userA: { id: userAId, name: 'Alice Reviewer', email: seedData.users[0].email },
    userB: { id: userBId, name: 'Bob Reviewer', email: seedData.users[1].email },
    orgId,
    cookiesA: sessionA,
    cookiesB: sessionB,
  };
}

async function getSessionCookies(userId: string): Promise<SessionCookie[]> {
  const res = await fetch(`${API_BASE}/api/test/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });

  if (!res.ok) {
    throw new Error(`Session failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.cookies;
}

export async function loginAs(context: BrowserContext, cookies: SessionCookie[]) {
  await context.addCookies(cookies);
  await context.addInitScript(() => {
    localStorage.setItem('corates-welcome-dismissed', 'true');
  });
}

/**
 * Login helper kept for API compatibility with callers from the split-worker era.
 * API and web now share :3010, so same-origin cookies work without forwarding.
 */
export async function loginWithApiCookies(
  context: BrowserContext,
  _page: Page,
  cookies: SessionCookie[],
) {
  await context.addCookies(cookies);
}

export async function switchUser(context: BrowserContext, cookies: SessionCookie[]) {
  await context.clearCookies();
  await context.addCookies(cookies);
}

/**
 * Add a project member via the test seeding route (uses addMember command).
 * Requires DEV_MODE=true on the workers backend.
 */
export async function addProjectMember(
  orgId: string,
  projectId: string,
  userId: string,
  _sessionCookies: SessionCookie[],
  role = 'member',
) {
  const res = await fetch(`${API_BASE}/api/test/add-project-member`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId, projectId, userId, role }),
  });
  if (!res.ok) {
    throw new Error(`Add project member failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Bulk-populate a project with studies through the in-page dev seeding seam
 * (`window.__devSeed`, exposed behind VITE_DEV_PANEL). Each study gets two
 * filled reviewer checklists; seeding runs the real client path — short-lived
 * engine sessions issuing the shared mutators — so it exercises the sync
 * engine exactly like a user would. The page must be signed in as a project
 * member with the app loaded.
 */
export async function seedStudies(
  page: Page,
  projectId: string,
  reviewer1Id: string,
  reviewer2Id: string,
  count: number,
  opts: { type?: string; fillMode?: string; reconcile?: boolean } = {},
) {
  const type = opts.type ?? 'AMSTAR2';
  const fillMode = opts.fillMode ?? 'random';
  const reconcile = opts.reconcile ?? false;

  await page.waitForFunction(
    () => typeof (window as { __devSeed?: unknown }).__devSeed !== 'undefined',
    undefined,
    { timeout: 20_000 },
  );

  // Each addStudy opens its own short-lived socket; batch to keep the
  // concurrent socket count bounded.
  const CONCURRENCY = 5;
  for (let start = 0; start < count; start += CONCURRENCY) {
    const batch = Math.min(CONCURRENCY, count - start);
    await page.evaluate(
      async args => {
        const seed = (
          window as unknown as {
            __devSeed: {
              addStudy: (projectId: string, opts: Record<string, unknown>) => Promise<unknown>;
            };
          }
        ).__devSeed;
        await Promise.all(
          Array.from({ length: args.batch }, (_, j) =>
            seed.addStudy(args.projectId, {
              type: args.type,
              fillMode: args.fillMode,
              reconcile: args.reconcile,
              reviewer1: args.reviewer1Id,
              reviewer2: args.reviewer2Id,
              studyNum: args.start + j + 1,
            }),
          ),
        );
      },
      { projectId, type, fillMode, reconcile, reviewer1Id, reviewer2Id, start, batch },
    );
  }
}

export async function cleanupScenario(scenario: DualReviewerScenario) {
  await fetch(`${API_BASE}/api/test/cleanup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userIds: [scenario.userA.id, scenario.userB.id],
      orgId: scenario.orgId,
    }),
  });
}

// --- Admin test helpers ---

export interface AdminScenario {
  admin: SeededUser;
  regularUser: SeededUser;
  orgId: string;
  adminCookies: SessionCookie[];
  regularCookies: SessionCookie[];
}

export async function seedAdminScenario(): Promise<AdminScenario> {
  const prefix = uniquePrefix('e2e-admin');
  const adminId = `${prefix}-admin`;
  const regularId = `${prefix}-user`;
  const orgId = `${prefix}-org`;

  const seedRes = await fetch(`${API_BASE}/api/test/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      users: [
        {
          id: adminId,
          name: 'Admin User',
          email: `admin-${prefix}@test.corates.org`,
          givenName: 'Admin',
          familyName: 'User',
          role: 'admin',
        },
        {
          id: regularId,
          name: 'Regular User',
          email: `regular-${prefix}@test.corates.org`,
          givenName: 'Regular',
          familyName: 'User',
        },
      ],
      org: { id: orgId, name: 'Admin Test Org', slug: `admin-org-${prefix}` },
      orgMembers: [
        { userId: adminId, role: 'owner' },
        { userId: regularId, role: 'member' },
      ],
    }),
  });

  if (!seedRes.ok) {
    throw new Error(`Admin seed failed: ${seedRes.status} ${await seedRes.text()}`);
  }

  const data = await seedRes.json();
  const adminCookies = await getSessionCookies(adminId);
  const regularCookies = await getSessionCookies(regularId);

  return {
    admin: { id: adminId, name: 'Admin User', email: data.users[0].email },
    regularUser: { id: regularId, name: 'Regular User', email: data.users[1].email },
    orgId,
    adminCookies,
    regularCookies,
  };
}

export async function cleanupAdminScenario(scenario: AdminScenario) {
  await fetch(`${API_BASE}/api/test/cleanup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userIds: [scenario.admin.id, scenario.regularUser.id],
      orgId: scenario.orgId,
    }),
  });
}

// --- Billing test helpers ---

export interface BillingScenario {
  user: SeededUser;
  orgId: string;
  cookies: SessionCookie[];
}

export interface SubscriptionOptions {
  plan?: string;
  status?: string;
  /** Unix timestamp in seconds */
  periodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  /** Unix timestamp in seconds */
  trialEnd?: number;
  seats?: number;
}

/**
 * Seeds a single user + org with a customizable subscription.
 * Defaults to starter_team/active if no subscription options are provided.
 */
export async function seedBillingScenario(
  subscriptionOpts?: SubscriptionOptions,
): Promise<BillingScenario> {
  const prefix = uniquePrefix('e2e-billing');
  const userId = `${prefix}-user`;
  const orgId = `${prefix}-org`;

  const seedRes = await fetch(`${API_BASE}/api/test/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      users: [
        {
          id: userId,
          name: 'Billing Test User',
          email: `billing-${prefix}@test.corates.org`,
          givenName: 'Billing',
          familyName: 'User',
        },
      ],
      org: { id: orgId, name: 'Billing Test Org', slug: `billing-org-${prefix}` },
      orgMembers: [{ userId, role: 'owner' }],
      subscription: subscriptionOpts,
    }),
  });

  if (!seedRes.ok) {
    throw new Error(`Billing seed failed: ${seedRes.status} ${await seedRes.text()}`);
  }

  const data = await seedRes.json();
  const cookies = await getSessionCookies(userId);

  return {
    user: { id: userId, name: 'Billing Test User', email: data.users[0].email },
    orgId,
    cookies,
  };
}

/**
 * Updates subscription state for an org mid-test.
 */
export async function updateSubscription(
  orgId: string,
  opts: { plan?: string; status?: string; periodEnd?: number; cancelAtPeriodEnd?: boolean },
) {
  const res = await fetch(`${API_BASE}/api/test/update-subscription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId, ...opts }),
  });
  if (!res.ok) {
    throw new Error(`Update subscription failed: ${res.status} ${await res.text()}`);
  }
}

export async function cleanupBillingScenario(scenario: BillingScenario) {
  await fetch(`${API_BASE}/api/test/cleanup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userIds: [scenario.user.id],
      orgId: scenario.orgId,
    }),
  });
}

// --- Auth flow helpers ---

/**
 * Fetches a stored auth URL from the backend test endpoint. Invitation URLs
 * are captured by DEV_MODE code in send-invitation-email.ts. Retries a few
 * times since the URL may not be stored instantly.
 */
export async function getAuthUrl(email: string, type: 'invitation'): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const res = await fetch(
      `${API_BASE}/api/test/auth-url?email=${encodeURIComponent(email)}&type=${type}`,
    );
    if (res.ok) {
      const data = await res.json();
      return data.url;
    }
    // URL may not be stored yet, wait and retry
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`No ${type} URL found for ${email} after retries`);
}

/**
 * Fetches the pending emailed code for an address. Codes are stored in the
 * verification table by the email-otp and onboarding plugins.
 */
export async function getAuthCode(
  email: string,
  type: 'sign-in' | 'email-verification' | 'forget-password' | 'onboarding-email',
): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const res = await fetch(
      `${API_BASE}/api/test/auth-code?email=${encodeURIComponent(email)}&type=${type}`,
    );
    if (res.ok) {
      const data = await res.json();
      return data.code;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`No ${type} code found for ${email} after retries`);
}

/**
 * Signs up (or in) through the email code UI on the current page, which
 * must already be on /signin or /signup with the email code form visible.
 */
export async function submitEmailCodeSignIn(page: Page, email: string) {
  const emailInput = page.locator('#email-code-email');
  await emailInput.click();
  await emailInput.pressSequentially(email, { delay: 20 });
  await page.getByRole('button', { name: /Continue with Email|Send Code/i }).click();
  await expect(page.getByText('Enter your code')).toBeVisible({ timeout: 10_000 });

  const code = await getAuthCode(email, 'sign-in');
  await page.locator('#email-code-input').fill(code);
}

/**
 * Creates a user via Better Auth's sign-up API.
 * Returns the response data (user may need email verification).
 */
export async function signUpWithEmail(email: string, password: string, name: string) {
  const res = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3010',
    },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    throw new Error(`Sign-up failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Marks a user's email as verified (and optionally profile as complete)
 * via the test endpoint. Skips the email verification flow.
 */
export async function verifyEmail(email: string, completeProfile = false) {
  const res = await fetch(`${API_BASE}/api/test/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, completeProfile }),
  });
  if (!res.ok) {
    throw new Error(`Verify email failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Cleans up a test user by email address.
 * Removes user, account, session, member, and verification records.
 */
export async function cleanupByEmail(email: string) {
  await fetch(`${API_BASE}/api/test/cleanup-user-by-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}
