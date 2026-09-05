import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import {
  listNotifications as listNotificationsImpl,
  getUnreadCount as getUnreadCountImpl,
  markRead as markReadImpl,
  markAllRead as markAllReadImpl,
  dismiss as dismissImpl,
} from './notifications.server';

const cursorSchema = z.object({ createdAt: z.number().int(), id: z.string().min(1) });

export const listNotifications = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(
    z
      .object({
        limit: z.number().int().min(1).max(50).optional(),
        before: cursorSchema.optional(),
      })
      .optional(),
  )
  .handler(async ({ data, context: { db, session } }) =>
    listNotificationsImpl(db, session, data ?? {}),
  );

export const getUnreadNotificationCount = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => getUnreadCountImpl(db, session));

export const markNotificationsRead = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ ids: z.array(z.string().min(1)).min(1).max(50) }))
  .handler(async ({ data, context: { db, session } }) => markReadImpl(db, session, data));

export const markAllNotificationsRead = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => markAllReadImpl(db, session));

export const dismissNotification = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data, context: { db, session } }) => dismissImpl(db, session, data));
