import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { notifications } from '@corates/db/schema';
import type { NotificationId, UserId } from '@corates/shared/ids';
import { eq } from 'drizzle-orm';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { buildUser, resetCounter } from '@/__tests__/server/factories';
import type { Session } from '@/server/middleware/auth';
import {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  dismiss,
} from '@/server/functions/notifications.server';

function sessionFor(userId: UserId): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: 'Test' },
    session: { id: `sess-${userId}`, userId },
  } as unknown as Session;
}

async function insertRows(userId: UserId, count: number, baseMs: number) {
  const db = createDb(env.DB);
  for (let i = 0; i < count; i++) {
    await db.insert(notifications).values({
      id: `${userId}-n${i}` as NotificationId,
      userId,
      type: 'invitation.accepted',
      data: JSON.stringify({
        projectId: 'p1',
        projectName: 'Project',
        acceptedByName: `Person ${i}`,
        acceptedByEmail: `p${i}@example.com`,
      }),
      createdAt: new Date(baseMs + i * 1000),
    });
  }
}

describe('notification server functions', () => {
  beforeEach(async () => {
    await resetTestDatabase();
    resetCounter();
  });

  it('lists only the session user rows, newest first, with parsed data', async () => {
    const alice = await buildUser();
    const bob = await buildUser();
    const base = Date.now() - 60_000;
    await insertRows(alice.id, 2, base);
    await insertRows(bob.id, 1, base);

    const result = await listNotifications(createDb(env.DB), sessionFor(alice.id));

    expect(result.items.map(n => n.id)).toEqual([`${alice.id}-n1`, `${alice.id}-n0`]);
    expect(result.items[0].data).toMatchObject({ acceptedByName: 'Person 1' });
    expect(result.nextCursor).toBeNull();
  });

  it('pages with a (createdAt, id) cursor', async () => {
    const alice = await buildUser();
    await insertRows(alice.id, 3, Date.now() - 60_000);
    const db = createDb(env.DB);

    const first = await listNotifications(db, sessionFor(alice.id), { limit: 2 });
    expect(first.items.map(n => n.id)).toEqual([`${alice.id}-n2`, `${alice.id}-n1`]);
    expect(first.nextCursor).not.toBeNull();

    const second = await listNotifications(db, sessionFor(alice.id), {
      limit: 2,
      before: first.nextCursor!,
    });
    expect(second.items.map(n => n.id)).toEqual([`${alice.id}-n0`]);
    expect(second.nextCursor).toBeNull();
  });

  it('marks read only for the session user and counts the rest', async () => {
    const alice = await buildUser();
    const bob = await buildUser();
    const base = Date.now() - 60_000;
    await insertRows(alice.id, 2, base);
    await insertRows(bob.id, 1, base);
    const db = createDb(env.DB);

    // Bob cannot mark Alice's rows
    await markRead(db, sessionFor(bob.id), { ids: [`${alice.id}-n0`] });
    expect(await getUnreadCount(db, sessionFor(alice.id))).toBe(2);

    await markRead(db, sessionFor(alice.id), { ids: [`${alice.id}-n0`] });
    expect(await getUnreadCount(db, sessionFor(alice.id))).toBe(1);
    const row = await db
      .select({ readAt: notifications.readAt })
      .from(notifications)
      .where(eq(notifications.id, `${alice.id}-n0` as NotificationId))
      .get();
    expect(row?.readAt).toBeInstanceOf(Date);

    await markAllRead(db, sessionFor(alice.id));
    expect(await getUnreadCount(db, sessionFor(alice.id))).toBe(0);
    expect(await getUnreadCount(db, sessionFor(bob.id))).toBe(1);
  });

  it('dismisses only the session user row', async () => {
    const alice = await buildUser();
    const bob = await buildUser();
    const base = Date.now() - 60_000;
    await insertRows(alice.id, 2, base);
    await insertRows(bob.id, 1, base);
    const db = createDb(env.DB);

    await dismiss(db, sessionFor(bob.id), { id: `${alice.id}-n0` });
    expect(await getUnreadCount(db, sessionFor(alice.id))).toBe(2);

    await dismiss(db, sessionFor(alice.id), { id: `${alice.id}-n0` });
    expect((await listNotifications(db, sessionFor(alice.id))).items.map(n => n.id)).toEqual([
      `${alice.id}-n1`,
    ]);
    expect(await getUnreadCount(db, sessionFor(bob.id))).toBe(1);
  });
});
