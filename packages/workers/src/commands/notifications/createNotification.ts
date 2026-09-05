/**
 * Persist a notification for one user and push it to their live sessions.
 *
 * Always a side effect of an action that has already committed, so this never
 * throws: a failure here is logged and the caller's result is unaffected.
 */

import { createDb } from '@corates/db/client';
import { notifications } from '@corates/db/schema';
import type { NotificationId, UserId } from '@corates/shared/ids';
import type {
  NotificationPayloads,
  NotificationRecord,
  NotificationType,
} from '@corates/shared/notifications';
import { and, desc, eq, notInArray } from 'drizzle-orm';
import { captureError } from '../../lib/logger';
import { notifyUser } from '../lib/notifications';
import type { Env } from '../../types';

export const MAX_NOTIFICATIONS_PER_USER = 200;

interface CreateNotificationParams<T extends NotificationType> {
  userId: UserId;
  type: T;
  data: NotificationPayloads[T];
}

export async function createNotification<T extends NotificationType>(
  env: Env,
  { userId, type, data }: CreateNotificationParams<T>,
): Promise<NotificationRecord | null> {
  const db = createDb(env.DB);
  const id = crypto.randomUUID() as NotificationId;
  const createdAt = new Date();

  try {
    await db.insert(notifications).values({
      id,
      userId,
      type,
      data: JSON.stringify(data),
      createdAt,
    });

    const keep = db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(MAX_NOTIFICATIONS_PER_USER);
    await db
      .delete(notifications)
      .where(and(eq(notifications.userId, userId), notInArray(notifications.id, keep)));
  } catch (err) {
    captureError(err, {
      tags: { component: 'notifications', action: 'create' },
      extra: { userId, type },
    });
    return null;
  }

  const record = { id, type, data, readAt: null, createdAt: createdAt.getTime() } as NotificationRecord;

  try {
    await notifyUser(env, userId, { type: 'notification:new', notification: record });
  } catch (err) {
    captureError(err, {
      tags: { component: 'notifications', action: 'push' },
      extra: { userId, type },
    });
  }

  return record;
}
