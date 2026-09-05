import type { Database } from '@corates/db/client';
import { notifications } from '@corates/db/schema';
import type { NotificationRecord } from '@corates/shared/notifications';
import { and, count, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import type { Session } from '@/server/middleware/auth';

export interface ListNotificationsParams {
  limit?: number;
  /** Return rows strictly older than this (createdAt, id) pair */
  before?: { createdAt: number; id: string };
}

export interface ListNotificationsResult {
  items: NotificationRecord[];
  nextCursor: { createdAt: number; id: string } | null;
}

function toRecord(row: typeof notifications.$inferSelect): NotificationRecord {
  return {
    id: row.id,
    type: row.type,
    data: JSON.parse(row.data),
    readAt: row.readAt ? row.readAt.getTime() : null,
    createdAt: row.createdAt.getTime(),
  } as NotificationRecord;
}

export async function listNotifications(
  db: Database,
  session: Session,
  { limit = 20, before }: ListNotificationsParams = {},
): Promise<ListNotificationsResult> {
  const beforeDate = before ? new Date(before.createdAt) : null;

  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, session.user.id),
        before && beforeDate ?
          or(
            lt(notifications.createdAt, beforeDate),
            and(eq(notifications.createdAt, beforeDate), lt(notifications.id, before.id)),
          )
        : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map(toRecord),
    nextCursor:
      rows.length > limit && last ? { createdAt: last.createdAt.getTime(), id: last.id } : null,
  };
}

export async function getUnreadCount(db: Database, session: Session): Promise<number> {
  const [{ count: unread }] = await db
    .select({ count: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, session.user.id), isNull(notifications.readAt)));
  return unread;
}

export async function markRead(
  db: Database,
  session: Session,
  { ids }: { ids: string[] },
): Promise<{ success: true }> {
  if (ids.length > 0) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, session.user.id),
          inArray(notifications.id, ids),
          isNull(notifications.readAt),
        ),
      );
  }
  return { success: true };
}

export async function markAllRead(db: Database, session: Session): Promise<{ success: true }> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, session.user.id), isNull(notifications.readAt)));
  return { success: true };
}
