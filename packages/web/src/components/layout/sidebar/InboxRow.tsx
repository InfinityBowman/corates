/**
 * InboxRow - sidebar entry point to the notification center, with unread count.
 */

import { useQuery } from '@tanstack/react-query';
import { InboxIcon } from 'lucide-react';
import { getUnreadNotificationCount } from '@/server/functions/notifications.functions';
import { queryKeys } from '@/lib/queryKeys';
import { NotificationsPopover } from '../NotificationsPopover';
import { navRowClass } from '../navStyles';

export function InboxRow() {
  const { data: unreadCount = 0 } = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: () => getUnreadNotificationCount(),
  });

  return (
    <NotificationsPopover side='right' align='start'>
      <button
        type='button'
        className={`${navRowClass(false)} aria-expanded:bg-muted aria-expanded:text-foreground`}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        <InboxIcon className='size-4 shrink-0' />
        <span className='flex-1 truncate text-left'>Inbox</span>
        {unreadCount > 0 && (
          <span
            data-testid='notification-badge'
            className='bg-primary text-primary-foreground flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold tabular-nums'
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </NotificationsPopover>
  );
}
