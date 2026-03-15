/**
 * QuestionPresenceIndicator - Colored rings on question pills showing who's viewing
 *
 * Features:
 * - Renders colored ring(s) around the parent element
 * - Supports multiple users with stacked rings
 * - Pulsing animation for visibility
 */

import type { RemoteUser } from '@/hooks/useReconciliationPresence';

interface QuestionPresenceIndicatorProps {
  users: RemoteUser[];
  maxRings?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function QuestionPresenceIndicator({
  users = [],
  maxRings = 2,
  size = 'md',
}: QuestionPresenceIndicatorProps) {
  if (users.length === 0) return null;

  const visibleUsers = users.slice(0, maxRings);

  const getOffset = (index: number) => {
    const offsets = { sm: 2, md: 3, lg: 4 };
    const base = offsets[size] || 3;
    return index * base;
  };

  const getRingWidth = () => {
    const widths = { sm: 2, md: 3, lg: 4 };
    return widths[size] || 3;
  };

  return (
    <div className="pointer-events-none absolute inset-0">
      {visibleUsers.map((user, index) => (
        <div
          key={user.clientId}
          className="absolute inset-0 animate-pulse rounded-full"
          style={{
            margin: `-${getOffset(index)}px`,
            border: `${getRingWidth()}px solid ${(user.color as Record<string, any>).hex}`,
            opacity: 0.85 - index * 0.15,
            boxShadow: `0 0 8px ${(user.color as Record<string, any>).hex}50`,
          }}
        />
      ))}
    </div>
  );
}
