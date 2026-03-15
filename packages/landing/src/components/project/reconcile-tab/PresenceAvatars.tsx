/**
 * PresenceAvatars - Displays stacked avatars of users viewing the reconciliation
 *
 * Features:
 * - Stacked avatar display with overlap
 * - Tooltip showing user name and current question
 * - Click to jump to user's current question
 * - Overflow indicator for many users
 */

import { useMemo } from 'react';
import { Avatar, AvatarImage, AvatarFallback, getInitials } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { API_BASE } from '@/config/api';
import type { RemoteUser } from '@/hooks/useReconciliationPresence';

interface PresenceAvatarsProps {
  users: RemoteUser[];
  onUserClick?: (_userId: string, _currentPage: number) => void;
  maxVisible?: number;
  getPageLabel?: (_pageIndex: number) => string;
}

export function PresenceAvatars({
  users,
  onUserClick,
  maxVisible = 4,
  getPageLabel,
}: PresenceAvatarsProps) {
  const visibleUsers = useMemo(() => users.slice(0, maxVisible), [users, maxVisible]);
  const overflowCount = Math.max(0, users.length - maxVisible);

  const getLabel = (pageIndex: number) => {
    if (getPageLabel) return getPageLabel(pageIndex);
    return `Question ${pageIndex + 1}`;
  };

  const getAvatarUrl = (user: RemoteUser) => {
    if (user.image) {
      if (user.image.startsWith('http')) return user.image;
      return `${API_BASE}/api/users/avatar/${user.userId}`;
    }
    return undefined;
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        <TooltipProvider>
          {visibleUsers.map(user => (
            <Tooltip key={user.clientId} delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onUserClick?.(user.userId, user.currentPage)}
                  className="focus:ring-primary relative rounded-full transition-transform hover:z-10 hover:scale-110 focus:z-10 focus:ring-2 focus:ring-offset-2 focus:outline-none"
                  style={{
                    boxShadow: `0 0 0 2px ${(user.color as Record<string, any>).hex}`,
                  }}
                >
                  <Avatar className="h-7 w-7 border-2 border-white text-xs">
                    <AvatarImage src={getAvatarUrl(user)} alt={user.name} />
                    <AvatarFallback
                      className="text-white"
                      style={{ backgroundColor: (user.color as Record<string, any>).hex }}
                    >
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="flex flex-col gap-0.5">
                <span className="font-medium">{user.name}</span>
                <span className="text-muted-foreground text-xs">
                  Viewing {getLabel(user.currentPage)}
                </span>
              </TooltipContent>
            </Tooltip>
          ))}

          {/* Overflow indicator */}
          {overflowCount > 0 && (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <div className="bg-muted text-muted-foreground flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-medium">
                  +{overflowCount}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {overflowCount} more {overflowCount === 1 ? 'person' : 'people'} viewing
              </TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    </div>
  );
}
