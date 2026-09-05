/**
 * One row in the bell popover. The whole row is the open target; mark-read and
 * dismiss sit outside that button (nested buttons are invalid) and appear in
 * place of the timestamp on hover or focus.
 */

import { CheckIcon, XIcon } from 'lucide-react';
import type { NotificationRecord } from '@corates/shared/notifications';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getInitials } from '@/components/ui/avatar';
import { renderNotification } from '@/components/notifications/renderers';
import { formatRelativeTime } from '@/components/dashboard/utils';
import { cn } from '@/lib/utils';

interface NotificationRowProps {
  notification: NotificationRecord;
  onOpen: (notification: NotificationRecord) => void;
  onMarkRead: (notification: NotificationRecord) => void;
  onDismiss: (notification: NotificationRecord) => void;
}

export function NotificationRow({
  notification,
  onOpen,
  onMarkRead,
  onDismiss,
}: NotificationRowProps) {
  const { title, actor, action, icon: Icon, destructive } = renderNotification(notification);
  const unread = !notification.readAt;

  return (
    <li className='group relative'>
      <button
        type='button'
        onClick={() => onOpen(notification)}
        className='hover:bg-accent focus-visible:ring-ring grid w-full grid-cols-[8px_28px_minmax(0,1fr)_auto] items-center gap-x-2.5 rounded-md py-2 pr-2 pl-1.5 text-left focus-visible:ring-2 focus-visible:outline-none'
      >
        <span
          aria-hidden='true'
          className={cn(
            'bg-primary size-1.5 justify-self-center rounded-full',
            !unread && 'invisible',
          )}
        />
        <span className='relative size-7'>
          <span className='bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full text-[10.5px] font-semibold'>
            {getInitials(actor ?? undefined)}
          </span>
          <span
            className={cn(
              'bg-popover group-hover:bg-accent text-muted-foreground absolute -right-1 -bottom-1 flex size-[15px] items-center justify-center rounded-full',
              destructive && 'text-destructive',
            )}
          >
            <Icon className='size-2.5' strokeWidth={2.4} aria-hidden='true' />
          </span>
        </span>
        <span className='min-w-0'>
          <span
            className={cn(
              'block truncate text-[13px] leading-snug',
              unread ? 'font-medium' : 'text-muted-foreground',
            )}
          >
            {title}
          </span>
          <span
            className={cn(
              'block truncate text-xs leading-snug',
              unread ? 'text-muted-foreground' : 'text-muted-foreground/70',
            )}
          >
            {actor && (
              <span
                className={cn('font-medium', unread ? 'text-foreground' : 'text-muted-foreground')}
              >
                {actor}{' '}
              </span>
            )}
            {action}
          </span>
        </span>
        <span className='text-muted-foreground/80 self-start pt-0.5 text-[11px] tabular-nums group-focus-within:invisible group-hover:invisible'>
          {formatRelativeTime(notification.createdAt)}
        </span>
      </button>
      <span className='absolute top-1.5 right-1.5 hidden items-center group-focus-within:flex group-hover:flex'>
        {unread && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='ghost'
                size='icon-xs'
                aria-label='Mark as read'
                onClick={() => onMarkRead(notification)}
              >
                <CheckIcon className='size-3.5' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mark as read</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='icon-xs'
              aria-label='Dismiss'
              onClick={() => onDismiss(notification)}
            >
              <XIcon className='size-3.5' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Dismiss</TooltipContent>
        </Tooltip>
      </span>
    </li>
  );
}
