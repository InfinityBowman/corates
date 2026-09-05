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
import { deleteProject } from '../deleteProject';

const OWNER = 'delete-notif-owner';
const MEMBERS = ['delete-notif-member-1', 'delete-notif-member-2'];
const ORG = 'delete-notif-org';
const PROJECT = 'delete-notif-project';

async function rowsFor(userId: string) {
  const db = createDb(env.DB);
  return db.select().from(notifications).where(eq(notifications.userId, userId));
}

describe('deleteProject persists notifications', () => {
  beforeEach(async () => {
    await resetTestDatabase();
    const now = Date.now();
    for (const id of [OWNER, ...MEMBERS]) {
      await seedUser({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now });
    }
    await seedOrganization({ id: ORG, name: 'Org', createdAt: now });
    await seedProject({
      id: PROJECT,
      name: 'Doomed Project',
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
    for (const [i, id] of MEMBERS.entries()) {
      await seedProjectMember({
        id: `pm-${i}`,
        projectId: PROJECT,
        userId: id,
        role: 'member',
        joinedAt: now,
      });
    }
  });

  it('notifies every member except the actor', async () => {
    await deleteProject(env, { id: OWNER }, { projectId: PROJECT });

    for (const id of MEMBERS) {
      const rows = await rowsFor(id);
      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('project.deleted');
      expect(JSON.parse(rows[0].data)).toEqual({
        projectId: PROJECT,
        projectName: 'Doomed Project',
        actorName: OWNER,
      });
    }
    expect(await rowsFor(OWNER)).toHaveLength(0);
  });
});
