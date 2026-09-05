import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { notifications } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import {
  resetTestDatabase,
  seedOrganization,
  seedProject,
  seedProjectMember,
  seedUser,
} from '../../../__tests__/helpers';
import { removeMember } from '../removeMember';

const OWNER = 'member-notif-owner';
const MEMBER = 'member-notif-member';
const ORG = 'member-notif-org';
const PROJECT = 'member-notif-project';

async function rowsFor(userId: string) {
  const db = createDb(env.DB);
  return db.select().from(notifications).where(eq(notifications.userId, userId));
}

describe('membership commands persist notifications', () => {
  beforeEach(async () => {
    await resetTestDatabase();
    const now = Date.now();
    for (const id of [OWNER, MEMBER]) {
      await seedUser({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now });
    }
    await seedOrganization({ id: ORG, name: 'Org', createdAt: now });
    await seedProject({
      id: PROJECT,
      name: 'Trial Appraisal',
      orgId: ORG,
      createdBy: OWNER,
      createdAt: now,
      updatedAt: now,
    });
    await seedProjectMember({
      id: 'pm-owner',
      projectId: PROJECT,
      userId: OWNER,
      role: 'owner',
      joinedAt: now,
    });
    await seedProjectMember({
      id: 'pm-member',
      projectId: PROJECT,
      userId: MEMBER,
      role: 'member',
      joinedAt: now,
    });
  });

  it('removeMember notifies the removed user, not the actor', async () => {
    await removeMember(
      env,
      { id: OWNER },
      { orgId: ORG, projectId: PROJECT, userId: MEMBER, isSelfRemoval: false },
    );

    const rows = await rowsFor(MEMBER);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('project.removed');
    expect(JSON.parse(rows[0].data)).toEqual({
      projectId: PROJECT,
      projectName: 'Trial Appraisal',
      actorName: OWNER,
    });
    expect(await rowsFor(OWNER)).toHaveLength(0);
  });

  it('removeMember on self-removal creates no notification', async () => {
    await removeMember(
      env,
      { id: MEMBER },
      { orgId: ORG, projectId: PROJECT, userId: MEMBER, isSelfRemoval: true },
    );

    expect(await rowsFor(MEMBER)).toHaveLength(0);
  });
});
