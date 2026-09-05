/**
 * NotificationBell - navbar entry point to the notification center.
 * Unread count is fetched eagerly; the list only when the popover opens.
 * Live updates arrive through useMembershipSync, which edits both caches.
 */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { BellIcon } from 'lucide-react';
import type { NotificationRecord } from '@corates/shared/notifications';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { renderNotification } from '@/components/notifications/renderers';
import { formatRelativeTime } from '@/components/dashboard/utils';
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
  markAllNotificationsRead,
} from '@/server/functions/notifications.functions';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';

function setListRead(predicate: (n: NotificationRecord) => boolean) {
  const now = Date.now();
  queryClient.setQueryData<NotificationRecord[]>(queryKeys.notifications.list, prev =>
    prev?.map(n => (predicate(n) && !n.readAt ? { ...n, readAt: now } : n)),
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: () => getUnreadNotificationCount(),
  });

  const { data: items, isPending } = useQuery({
    queryKey: queryKeys.notifications.list,
    queryFn: async () => (await listNotifications()).items,
    enabled: open,
  });

  async function handleOpen(notification: NotificationRecord) {
    const { href } = renderNotification(notification);
    setOpen(false);
    if (!notification.readAt) {
      setListRead(n => n.id === notification.id);
      queryClient.setQueryData<number>(queryKeys.notifications.unreadCount, prev =>
        Math.max(0, (prev ?? 1) - 1),
      );
      markNotificationsRead({ data: { ids: [notification.id] } })
        .catch(() => {})
        .finally(() => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }));
    }
    if (href) navigate({ to: href });
  }

  async function handleMarkAllRead() {
    setListRead(() => true);
    queryClient.setQueryData<number>(queryKeys.notifications.unreadCount, 0);
    try {
      await markAllNotificationsRead();
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Could not mark notifications as read' });
    } finally {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type='button'
          className='relative flex h-9 items-center rounded px-2 transition hover:bg-blue-600'
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <BellIcon className='size-4' aria-hidden='true' />
          {unreadCount > 0 && (
            <span
              data-testid='notification-badge'
              className='absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-none font-semibold text-white'
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-80 gap-0 p-0'>
        <div className='flex items-center justify-between border-b px-3 py-2'>
          <span className='font-semibold'>Notifications</span>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 text-xs'
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
          >
            Mark all as read
          </Button>
        </div>
        <ul className='max-h-96 overflow-y-auto' aria-label='Notification list'>
          {isPending ?
            <li className='text-muted-foreground px-3 py-6 text-center text-xs'>Loading</li>
          : items?.length ?
            items.map(notification => {
              const rendered = renderNotification(notification);
              return (
                <li key={notification.id} className='border-b last:border-b-0'>
                  <button
                    type='button'
                    onClick={() => handleOpen(notification)}
                    className={cn(
                      'hover:bg-accent flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left',
                      !notification.readAt && 'bg-blue-50/60 dark:bg-blue-950/30',
                    )}
                  >
                    <span className='flex w-full items-start justify-between gap-2'>
                      <span className={cn('text-sm', !notification.readAt && 'font-semibold')}>
                        {rendered.title}
                      </span>
                      <span className='text-muted-foreground shrink-0 text-xs'>
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </span>
                    {rendered.body && (
                      <span className='text-muted-foreground text-xs'>{rendered.body}</span>
                    )}
                  </button>
                </li>
              );
            })
          : <li className='text-muted-foreground px-3 py-6 text-center text-xs'>
              You're all caught up
            </li>
          }
        </ul>
      </PopoverContent>
    </Popover>
  );
}
