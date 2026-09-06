/**
 * The e2e helpers retry these routes after a lost response, so calling them
 * twice with the same body must succeed both times.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { member, projectMembers, user } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import {
  resetTestDatabase,
  seedOrganization,
  seedProject,
  seedProjectMember,
  seedUser,
} from '@/__tests__/server/helpers';
import { handler as seedHandler } from '../seed';
import { handler as addProjectMemberHandler } from '../add-project-member';

function post(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await resetTestDatabase();
});

describe('POST /api/test/seed', () => {
  const body = {
    users: [
      { id: 'e2e-user-a', name: 'Alice Reviewer', email: 'alice@test.corates.org' },
      { id: 'e2e-user-b', name: 'Bob Reviewer', email: 'bob@test.corates.org' },
    ],
    org: { id: 'e2e-org', name: 'E2E Test Org', slug: 'e2e-org' },
    orgMembers: [
      { userId: 'e2e-user-a', role: 'owner' },
      { userId: 'e2e-user-b', role: 'member' },
    ],
  };

  it('returns 200 on a repeated call and leaves one row per record', async () => {
    const first = await seedHandler({ request: post('/api/test/seed', body) });
    expect(first.status).toBe(200);

    const second = await seedHandler({ request: post('/api/test/seed', body) });
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ success: true, org: { id: 'e2e-org' } });

    const db = createDb(env.DB);
    expect(await db.select().from(user).where(eq(user.id, 'e2e-user-a'))).toHaveLength(1);
    expect(await db.select().from(member).where(eq(member.organizationId, 'e2e-org'))).toHaveLength(
      2,
    );
  });
});

describe('POST /api/test/add-project-member', () => {
  it('returns 200 without inserting when the user is already a project member', async () => {
    const now = new Date();
    await seedUser({
      id: 'owner',
      name: 'Owner',
      email: 'owner@test.corates.org',
      createdAt: now,
      updatedAt: now,
    });
    await seedUser({
      id: 'bob',
      name: 'Bob',
      email: 'bob@test.corates.org',
      createdAt: now,
      updatedAt: now,
    });
    await seedOrganization({ id: 'org-1', name: 'Org', createdAt: now });
    await seedProject({
      id: 'proj-1',
      name: 'Project',
      orgId: 'org-1',
      createdBy: 'owner',
      createdAt: now,
      updatedAt: now,
    });
    await seedProjectMember({ id: 'pm-1', projectId: 'proj-1', userId: 'bob', joinedAt: now });

    const res = await addProjectMemberHandler({
      request: post('/api/test/add-project-member', {
        orgId: 'org-1',
        projectId: 'proj-1',
        userId: 'bob',
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, alreadyMember: true });

    const db = createDb(env.DB);
    expect(
      await db.select().from(projectMembers).where(eq(projectMembers.projectId, 'proj-1')),
    ).toHaveLength(1);
  });
});
