import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:workers';
import { runInDurableObject } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { notifications } from '@corates/db/schema';
import type { NotificationId, UserId } from '@corates/shared/ids';
import { asc, eq } from 'drizzle-orm';
import { resetTestDatabase, seedUser } from '../../../__tests__/helpers';
import type { UserSession } from '../../../durable-objects/UserSession';
import { createNotification, MAX_NOTIFICATIONS_PER_USER } from '../createNotification';

const USER_ID = 'notif-user-1' as UserId;

const acceptedData = {
  projectId: 'proj-1',
  projectName: 'Trial Appraisal',
  acceptedByName: 'Reviewer Two',
  acceptedByEmail: 'two@example.com',
};

async function readPending(userId: string) {
  const stub = env.USER_SESSION.get(env.USER_SESSION.idFromName(userId));
  return runInDurableObject(stub, async (_instance: UserSession, state: DurableObjectState) => {
    const pending = (await state.storage.get<Array<Record<string, unknown>>>(
      'pendingNotifications',
    )) as Array<Record<string, unknown>> | undefined;
    await state.storage.deleteAll();
    return pending ?? [];
  });
}

describe('createNotification', () => {
  beforeEach(async () => {
    await resetTestDatabase();
    await readPending(USER_ID);
    const now = Date.now();
    await seedUser({
      id: USER_ID,
      name: 'Notif User',
      email: 'notif@example.com',
      createdAt: now,
      updatedAt: now,
    });
  });

  it('inserts a row with the JSON payload and returns the wire record', async () => {
    const record = await createNotification(env, {
      userId: USER_ID,
      type: 'invitation.accepted',
      data: acceptedData,
    });

    expect(record).not.toBeNull();
    expect(record?.type).toBe('invitation.accepted');
    expect(record?.readAt).toBeNull();

    const db = createDb(env.DB);
    const rows = await db.select().from(notifications).where(eq(notifications.userId, USER_ID));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(record?.id);
    expect(JSON.parse(rows[0].data)).toEqual(acceptedData);
    expect(rows[0].createdAt.getTime()).toBe(record?.createdAt);
  });

  it('pushes a notification:new event to the user session', async () => {
    const record = await createNotification(env, {
      userId: USER_ID,
      type: 'invitation.accepted',
      data: acceptedData,
    });

    const pending = await readPending(USER_ID);
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('notification:new');
    expect(pending[0].notification).toEqual(record);
  });

  it('keeps only the newest rows once the per-user cap is exceeded', async () => {
    const db = createDb(env.DB);
    const base = Date.now() - 1_000_000;
    const seeded = Array.from({ length: MAX_NOTIFICATIONS_PER_USER }, (_, i) => ({
      id: `old-${String(i).padStart(3, '0')}` as NotificationId,
      userId: USER_ID,
      type: 'invitation.accepted',
      data: JSON.stringify(acceptedData),
      createdAt: new Date(base + i),
    }));
    // D1 caps bound parameters per statement, so insert in chunks
    for (let i = 0; i < seeded.length; i += 20) {
      await db.insert(notifications).values(seeded.slice(i, i + 20));
    }

    const record = await createNotification(env, {
      userId: USER_ID,
      type: 'invitation.accepted',
      data: acceptedData,
    });

    const rows = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.userId, USER_ID))
      .orderBy(asc(notifications.createdAt));
    expect(rows).toHaveLength(MAX_NOTIFICATIONS_PER_USER);
    expect(rows[0].id).toBe('old-001');
    expect(rows.at(-1)?.id).toBe(record?.id);
  });
});
