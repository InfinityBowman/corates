import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:workers';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedOrgMember,
  seedSubscription,
  seedProject,
} from '../../__tests__/helpers.js';
import { createDb } from '@corates/db/client';
import type { OrgId, UserId } from '@corates/shared/ids';
import { checkFreeProjectCap, countFreeProjectsOwnedByUser } from '../freeProjectCap.js';
import { createProject } from '../../commands/projects/createProject.js';
import type { Env } from '../../types';

const nowSec = Math.floor(Date.now() / 1000);
const userId = 'user-1' as UserId;
const orgA = 'org-a' as OrgId;
const orgB = 'org-b' as OrgId;

async function seedOrg(orgId: OrgId, ownerId: string, role: 'owner' | 'member' = 'owner') {
  await seedOrganization({ id: orgId, name: orgId, slug: orgId, createdAt: nowSec });
  await seedOrgMember({
    id: `member-${orgId}-${ownerId}`,
    userId: ownerId,
    organizationId: orgId,
    role,
    createdAt: nowSec,
  });
}

async function seedProjectIn(orgId: OrgId, id = `project-${orgId}`) {
  await seedProject({
    id,
    name: id,
    orgId,
    createdBy: userId,
    createdAt: nowSec,
    updatedAt: nowSec,
  });
}

async function subscribe(orgId: OrgId) {
  await seedSubscription({
    id: `sub-${orgId}`,
    plan: 'team',
    referenceId: orgId,
    status: 'active',
    createdAt: nowSec,
    updatedAt: nowSec,
    periodStart: nowSec,
    periodEnd: nowSec + 86400 * 30,
  });
}

beforeEach(async () => {
  await resetTestDatabase();
  await seedUser({
    id: userId,
    name: 'User 1',
    email: 'user1@example.com',
    createdAt: nowSec,
    updatedAt: nowSec,
  });
  await seedOrg(orgA, userId);
  await seedOrg(orgB, userId);
});

describe('countFreeProjectsOwnedByUser', () => {
  it('counts projects across every free org the user owns', async () => {
    await seedProjectIn(orgA);
    await seedProjectIn(orgB);

    expect(await countFreeProjectsOwnedByUser(createDb(env.DB), userId)).toBe(2);
  });

  it('ignores projects in orgs on a paid plan', async () => {
    await seedProjectIn(orgA);
    await subscribe(orgA);
    await seedProjectIn(orgB);

    expect(await countFreeProjectsOwnedByUser(createDb(env.DB), userId)).toBe(1);
  });

  it('ignores orgs where the user is not an owner', async () => {
    const otherUser = 'user-2';
    await seedUser({
      id: otherUser,
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });
    const orgC = 'org-c' as OrgId;
    await seedOrg(orgC, otherUser);
    await seedOrgMember({
      id: 'member-c-user-1',
      userId,
      organizationId: orgC,
      role: 'member',
      createdAt: nowSec,
    });
    await seedProjectIn(orgC);

    expect(await countFreeProjectsOwnedByUser(createDb(env.DB), userId)).toBe(0);
  });
});

describe('checkFreeProjectCap', () => {
  it('allows the first free project', async () => {
    const result = await checkFreeProjectCap(createDb(env.DB), userId, orgA);
    expect(result.allowed).toBe(true);
  });

  it('blocks a free project when the user already has one in another org they own', async () => {
    await seedProjectIn(orgA);

    const result = await checkFreeProjectCap(createDb(env.DB), userId, orgB);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error.details).toMatchObject({
        reason: 'free_project_cap',
        quotaKey: 'projects.max',
        used: 1,
        limit: 1,
      });
    }
  });

  it('does not apply when the target org is on a paid plan', async () => {
    await seedProjectIn(orgA);
    await subscribe(orgB);

    const result = await checkFreeProjectCap(createDb(env.DB), userId, orgB);
    expect(result.allowed).toBe(true);
  });

  it('frees the slot when the org holding the project subscribes', async () => {
    await seedProjectIn(orgA);
    await subscribe(orgA);

    const result = await checkFreeProjectCap(createDb(env.DB), userId, orgB);
    expect(result.allowed).toBe(true);
  });
});

describe('createProject', () => {
  it('rejects a second free project across owned orgs', async () => {
    await seedProjectIn(orgA);

    await expect(
      createProject(env as unknown as Env, { id: userId }, { orgId: orgB, name: 'Second' }),
    ).rejects.toMatchObject({ details: { reason: 'free_project_cap' } });
  });
});
