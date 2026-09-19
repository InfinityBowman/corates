import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:workers';
import { runInDurableObject } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { notifications } from '@corates/db/schema';
import type { UserId } from '@corates/shared/ids';
import { asc } from 'drizzle-orm';
import { resetTestDatabase, seedUser } from '../../../__tests__/helpers';
import type { UserSession } from '../../../durable-objects/UserSession';
import { sendAnnouncement } from '../sendAnnouncement';

const announcement = {
  title: 'Scheduled maintenance',
  body: 'CoRATES will be read-only on Sunday from 02:00 to 03:00 UTC.',
  href: '/resources',
};

async function seedUsers(count: number): Promise<UserId[]> {
  const now = Date.now();
  const ids: UserId[] = [];
  for (let i = 0; i < count; i++) {
    const id = `ann-user-${String(i).padStart(3, '0')}` as UserId;
    await seedUser({
      id,
      name: `User ${i}`,
      email: `${id}@example.com`,
      createdAt: now,
      updatedAt: now,
    });
    ids.push(id);
  }
  return ids;
}

async function readPending(userId: string) {
  const stub = env.USER_SESSION.get(env.USER_SESSION.idFromName(userId));
  return runInDurableObject(stub, async (_instance: UserSession, state: DurableObjectState) => {
    const pending = await state.storage.get<Array<Record<string, unknown>>>('pendingNotifications');
    await state.storage.deleteAll();
    return pending ?? [];
  });
}

describe('sendAnnouncement', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('writes one row per user across insert chunks and pushes to each', async () => {
    const ids = await seedUsers(45);

    const result = await sendAnnouncement(env, announcement);
    expect(result.sent).toBe(45);

    const db = createDb(env.DB);
    const rows = await db.select().from(notifications).orderBy(asc(notifications.userId));
    expect(rows.map(r => r.userId)).toEqual(ids);
    for (const row of rows) {
      expect(row.type).toBe('announcement');
      expect(JSON.parse(row.data)).toEqual(announcement);
      expect(row.readAt).toBeNull();
    }

    const pending = await readPending(ids[44]);
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('notification:new');
    expect((pending[0].notification as { id: string }).id).toBe(rows[44].id);
  });

  it('sends nothing when there are no users', async () => {
    const result = await sendAnnouncement(env, announcement);
    expect(result.sent).toBe(0);
  });
});
