/**
 * NotificationBell - navbar entry point to the notification center.
 * Unread count is fetched eagerly; the list only when the popover opens.
 * Live updates arrive through useMembershipSync, which edits both caches.
 */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { BellIcon, CheckCheckIcon, InboxIcon } from 'lucide-react';
import type { NotificationRecord } from '@corates/shared/notifications';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NotificationRow } from '@/components/notifications/NotificationRow';
import { renderNotification } from '@/components/notifications/renderers';
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
  markAllNotificationsRead,
  dismissNotification,
} from '@/server/functions/notifications.functions';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'unread';

function setListRead(predicate: (n: NotificationRecord) => boolean) {
  const now = Date.now();
  queryClient.setQueryData<NotificationRecord[]>(queryKeys.notifications.list, prev =>
    prev?.map(n => (predicate(n) && !n.readAt ? { ...n, readAt: now } : n)),
  );
}

function decrementUnread() {
  queryClient.setQueryData<number>(queryKeys.notifications.unreadCount, prev =>
    Math.max(0, (prev ?? 1) - 1),
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const navigate = useNavigate();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: () => getUnreadNotificationCount(),
  });

  const {
    data: items,
    isPending,
    isError,
  } = useQuery({
    queryKey: queryKeys.notifications.list,
    queryFn: async () => (await listNotifications()).items,
    enabled: open,
  });

  const visible = filter === 'unread' ? items?.filter(n => !n.readAt) : items;

  function markRead(notification: NotificationRecord) {
    setListRead(n => n.id === notification.id);
    decrementUnread();
    markNotificationsRead({ data: { ids: [notification.id] } })
      .catch(() => {})
      .finally(() => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }));
  }

  function handleOpen(notification: NotificationRecord) {
    const { href } = renderNotification(notification);
    setOpen(false);
    if (!notification.readAt) markRead(notification);
    if (href) navigate({ to: href });
  }

  async function handleDismiss(notification: NotificationRecord) {
    queryClient.setQueryData<NotificationRecord[]>(queryKeys.notifications.list, prev =>
      prev?.filter(n => n.id !== notification.id),
    );
    if (!notification.readAt) decrementUnread();
    try {
      await dismissNotification({ data: { id: notification.id } });
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Could not dismiss notification' });
    } finally {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    }
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
      <PopoverContent align='end' className='w-96 gap-0 p-0'>
        <div className='flex items-center justify-between border-b py-1.5 pr-1.5 pl-3.5'>
          <span className='flex items-center gap-2 text-[13px] font-semibold'>
            Notifications
            {unreadCount > 0 && (
              <span className='bg-primary/10 text-primary rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums'>
                {unreadCount}
              </span>
            )}
          </span>
          <div className='flex items-center gap-1.5'>
            <div
              role='group'
              aria-label='Filter notifications'
              className='flex overflow-hidden rounded-md border text-[11px] font-medium'
            >
              {(['all', 'unread'] as const).map(value => (
                <button
                  key={value}
                  type='button'
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    'text-muted-foreground hover:text-foreground px-2 py-0.5',
                    filter === value && 'bg-muted text-foreground',
                  )}
                >
                  {value === 'all' ? 'All' : 'Unread'}
                </button>
              ))}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  aria-label='Mark all as read'
                  onClick={handleMarkAllRead}
                  disabled={unreadCount === 0}
                >
                  <CheckCheckIcon className='size-3.5' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mark all as read</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <ul className='max-h-96 overflow-y-auto p-1' aria-label='Notification list'>
          {isPending ?
            <li className='text-muted-foreground px-3 py-6 text-center text-xs'>Loading</li>
          : isError ?
            <li className='text-destructive px-3 py-6 text-center text-xs'>
              Could not load notifications
            </li>
          : visible?.length ?
            visible.map(notification => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onOpen={handleOpen}
                onMarkRead={markRead}
                onDismiss={handleDismiss}
              />
            ))
          : <li className='text-muted-foreground flex flex-col items-center gap-1 px-4 py-7 text-center'>
              <InboxIcon className='size-5' aria-hidden='true' />
              <span className='text-foreground/80 text-[13px] font-medium'>
                {filter === 'unread' ? 'No unread notifications' : "You're all caught up"}
              </span>
              {filter === 'all' && (
                <span className='text-xs'>Invitations and project changes land here.</span>
              )}
            </li>
          }
        </ul>
      </PopoverContent>
    </Popover>
  );
}
