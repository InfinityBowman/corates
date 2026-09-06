/**
 * MemberAvatar - A member's photo, or initials on a colour keyed to their name.
 */

import { Avatar, AvatarImage, AvatarFallback, getInitials } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { API_BASE } from '@/config/api';

export interface MemberLike {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-200',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200',
];

export function memberDisplayName(member: MemberLike | null | undefined): string {
  return member?.name || member?.email || 'Unknown';
}

export function MemberAvatar({ member, className }: { member: MemberLike; className?: string }) {
  const name = memberDisplayName(member);
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  const src =
    member.image ?
      member.image.startsWith('/') ?
        `${API_BASE}${member.image}`
      : member.image
    : undefined;

  return (
    <Avatar className={cn('size-7 text-xs', className)}>
      <AvatarImage src={src} alt={name} />
      <AvatarFallback className={cn('font-medium', color)}>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
