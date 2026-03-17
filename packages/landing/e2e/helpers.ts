/**
 * E2E test helpers
 * Seed data, auth cookies, and cleanup via the backend test-seed endpoints
 */

import type { BrowserContext } from '@playwright/test';

const API_BASE = 'http://localhost:8787';

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

const TEST_PREFIX = 'e2e-' + Date.now();

export async function seedDualReviewerScenario(): Promise<DualReviewerScenario> {
  const userAId = `${TEST_PREFIX}-user-a`;
  const userBId = `${TEST_PREFIX}-user-b`;
  const orgId = `${TEST_PREFIX}-org`;

  const seedRes = await fetch(`${API_BASE}/api/test/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      users: [
        {
          id: userAId,
          name: 'Alice Reviewer',
          email: `alice-${TEST_PREFIX}@test.corates.org`,
          givenName: 'Alice',
          familyName: 'Reviewer',
        },
        {
          id: userBId,
          name: 'Bob Reviewer',
          email: `bob-${TEST_PREFIX}@test.corates.org`,
          givenName: 'Bob',
          familyName: 'Reviewer',
        },
      ],
      org: { id: orgId, name: 'E2E Test Org', slug: `e2e-org-${TEST_PREFIX}` },
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
}

export async function switchUser(context: BrowserContext, cookies: SessionCookie[]) {
  await context.clearCookies();
  await context.addCookies(cookies);
}

/**
 * Add a project member via the real API (handles both DB + Yjs sync).
 * Requires the session cookie of an authenticated project owner.
 */
export async function addProjectMember(
  orgId: string,
  projectId: string,
  userId: string,
  sessionCookies: SessionCookie[],
  role = 'member',
) {
  const cookieHeader = sessionCookies.map(c => `${c.name}=${c.value}`).join('; ');
  const res = await fetch(`${API_BASE}/api/orgs/${orgId}/projects/${projectId}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ userId, role }),
  });
  if (!res.ok) {
    throw new Error(`Add project member failed: ${res.status} ${await res.text()}`);
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
