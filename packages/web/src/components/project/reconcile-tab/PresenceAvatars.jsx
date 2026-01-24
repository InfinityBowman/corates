/**
 * PresenceAvatars - Displays stacked avatars of users viewing the reconciliation
 *
 * Features:
 * - Stacked avatar display with overlap
 * - Tooltip showing user name and current question
 * - Click to jump to user's current question
 * - Overflow indicator for many users
 */

import { For, Show } from 'solid-js';
import { Avatar, AvatarImage, AvatarFallback, getInitials } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipTrigger,
  TooltipPositioner,
  TooltipContent,
} from '@/components/ui/tooltip';
import { API_BASE } from '@config/api.js';

/**
 * @param {Object} props
 * @param {Array} props.users - Array of presence users with { userId, name, image, currentPage, color }
 * @param {Function} props.onUserClick - Callback when user avatar is clicked (receives userId, currentPage)
 * @param {number} [props.maxVisible=4] - Maximum number of avatars to show before overflow
 * @param {Function} [props.getPageLabel] - Function to convert page index to display label (default: "Question N")
 */
export default function PresenceAvatars(props) {
  const maxVisible = () => props.maxVisible ?? 4;
  const visibleUsers = () => props.users.slice(0, maxVisible());
  const overflowCount = () => Math.max(0, props.users.length - maxVisible());

  const getPageLabel = pageIndex => {
    if (props.getPageLabel) {
      return props.getPageLabel(pageIndex);
    }
    return `Question ${pageIndex + 1}`;
  };

  // Build avatar URL from user data
  const getAvatarUrl = user => {
    if (user.image) {
      // If it's a full URL, use it directly
      if (user.image.startsWith('http')) {
        return user.image;
      }
      // Otherwise, it's a path to our API
      return `${API_BASE}/api/users/avatar/${user.userId}`;
    }
    return null;
  };

  return (
    <div class='flex items-center gap-2'>
      <div class='flex -space-x-2'>
        <For each={visibleUsers()}>
          {user => (
            <Tooltip openDelay={200} positioning={{ placement: 'bottom' }}>
              <TooltipTrigger>
                <button
                  onClick={() => props.onUserClick?.(user.userId, user.currentPage)}
                  class='focus:ring-primary relative rounded-full transition-transform hover:z-10 hover:scale-110 focus:z-10 focus:ring-2 focus:ring-offset-2 focus:outline-none'
                  style={{
                    'box-shadow': `0 0 0 2px ${user.color.hex}`,
                  }}
                >
                  <Avatar class='h-7 w-7 border-2 border-white text-xs'>
                    <AvatarImage src={getAvatarUrl(user)} alt={user.name} />
                    <AvatarFallback
                      class={`${user.color.bg} text-white`}
                      style={{ 'background-color': user.color.hex }}
                    >
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </TooltipTrigger>
              <TooltipPositioner>
                <TooltipContent class='flex flex-col gap-0.5'>
                  <span class='font-medium'>{user.name}</span>
                  <span class='text-muted-foreground text-xs'>
                    Viewing {getPageLabel(user.currentPage)}
                  </span>
                </TooltipContent>
              </TooltipPositioner>
            </Tooltip>
          )}
        </For>

        {/* Overflow indicator */}
        <Show when={overflowCount() > 0}>
          <Tooltip openDelay={200} positioning={{ placement: 'bottom' }}>
            <TooltipTrigger>
              <div class='bg-muted text-muted-foreground flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-medium'>
                +{overflowCount()}
              </div>
            </TooltipTrigger>
            <TooltipPositioner>
              <TooltipContent>
                {overflowCount()} more {overflowCount() === 1 ? 'person' : 'people'} viewing
              </TooltipContent>
            </TooltipPositioner>
          </Tooltip>
        </Show>
      </div>
    </div>
  );
}
