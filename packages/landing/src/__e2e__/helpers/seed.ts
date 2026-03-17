/**
 * Test data seeding helpers
 * Calls the backend test-seed endpoints via Vitest custom commands (Node-side)
 */

import { commands } from 'vitest/browser';

export interface SeededUser {
  id: string;
  name: string;
  email: string;
}

export interface DualReviewerScenario {
  userA: SeededUser;
  userB: SeededUser;
  orgId: string;
  cookieA: string;
  cookieB: string;
}

const TEST_PREFIX = 'e2e-' + Date.now();

export async function seedDualReviewerScenario(): Promise<DualReviewerScenario> {
  const userAId = `${TEST_PREFIX}-user-a`;
  const userBId = `${TEST_PREFIX}-user-b`;
  const orgId = `${TEST_PREFIX}-org`;

  // Seed users and org
  const seedResult = (await commands.seedTestData({
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
    org: { id: orgId, name: 'E2E Test Org' },
    orgMembers: [
      { userId: userAId, role: 'owner' },
      { userId: userBId, role: 'member' },
    ],
  })) as any;

  // Get session cookies for both users
  const sessionA = (await commands.getSessionCookie(userAId)) as any;
  const sessionB = (await commands.getSessionCookie(userBId)) as any;

  return {
    userA: { id: userAId, name: 'Alice Reviewer', email: seedResult.users?.[0]?.email },
    userB: { id: userBId, name: 'Bob Reviewer', email: seedResult.users?.[1]?.email },
    orgId,
    cookieA: sessionA.token,
    cookieB: sessionB.token,
  };
}

export async function cleanupScenario(scenario: DualReviewerScenario) {
  await commands.cleanupTestData({
    userIds: [scenario.userA.id, scenario.userB.id],
    orgId: scenario.orgId,
  });
}
