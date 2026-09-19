/**
 * Fan an operator-authored announcement out as one notification row per user.
 *
 * Rows are inserted in chunks rather than through createNotification because
 * every D1 query and DO call counts against the 1000-subrequest limit of the
 * request doing the send. The per-user cap is not enforced here: one row past
 * it is trimmed by the next ordinary notification.
 */

import { createDb } from '@corates/db/client';
import { notifications, user } from '@corates/db/schema';
import type { NotificationId } from '@corates/shared/ids';
import type { NotificationPayloads, NotificationRecord } from '@corates/shared/notifications';
import { captureError } from '../../lib/logger';
import { notifyUser } from '../lib/notifications';
import type { Env } from '../../types';

// D1 binds at most 100 parameters per statement and a row binds five.
const INSERT_CHUNK = 20;

export async function sendAnnouncement(
  env: Env,
  data: NotificationPayloads['announcement'],
): Promise<{ sent: number }> {
  const db = createDb(env.DB);
  const users = await db.select({ id: user.id }).from(user);
  const createdAt = new Date();
  const serialized = JSON.stringify(data);

  const rows = users.map(({ id }) => ({
    id: crypto.randomUUID() as NotificationId,
    userId: id,
    type: 'announcement',
    data: serialized,
    createdAt,
  }));

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    await db.insert(notifications).values(rows.slice(i, i + INSERT_CHUNK));
  }

  // Best-effort like createNotification: the row is in D1 and the client
  // refetches on reconnect, so a failed push only delays it.
  await Promise.all(
    rows.map(async row => {
      const record: NotificationRecord = {
        id: row.id,
        type: 'announcement',
        data,
        readAt: null,
        createdAt: createdAt.getTime(),
      };
      try {
        await notifyUser(env, row.userId, { type: 'notification:new', notification: record });
      } catch (err) {
        captureError(err, {
          tags: { component: 'notifications', action: 'push' },
          extra: { userId: row.userId, type: 'announcement' },
        });
      }
    }),
  );

  return { sent: rows.length };
}
