/**
 * RemoteCursors - Floating cursor overlay showing other users' mouse positions
 *
 * Features:
 * - Renders colored cursor arrows with name labels
 * - Smooth position updates via CSS transforms
 * - Handles scroll position differences
 */

import type { RemoteUser } from '@/hooks/useReconciliationPresence';

function CursorIcon({ color }: { color: string }) {
  return (
    <svg
      width="20"
      height="24"
      viewBox="0 0 20 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.25))' }}
    >
      <path
        d="M2 1L2 21L8 15L18 15L2 1Z"
        fill={color}
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface RemoteCursorsProps {
  users: RemoteUser[];
  containerScrollY: number;
}

export function RemoteCursors({ users, containerScrollY }: RemoteCursorsProps) {
  const activeCursors = users || [];

  // cursor.y is content position (viewport Y + scrollTop when recorded)
  // To display: convert content position to viewport position by subtracting local scroll
  const getAdjustedY = (cursor: { y: number }) => {
    return cursor.y - (containerScrollY ?? 0);
  };

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 9999 }}>
      {activeCursors.map(user => {
        if (!user.cursor) return null;
        const x = user.cursor.x;
        const y = getAdjustedY(user.cursor);

        return (
          <div
            key={user.clientId}
            className="absolute top-0 left-0"
            style={{
              transform: `translate(${x}px, ${y}px)`,
              zIndex: 9999,
              transition: 'transform 150ms ease-out',
            }}
          >
            <CursorIcon color={(user.color as Record<string, any>).hex} />

            {/* Name label */}
            <div
              className="-mt-1 ml-3 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-white shadow-sm"
              style={{
                backgroundColor: (user.color as Record<string, any>).hex,
                borderRadius: '2px 6px 6px 6px',
              }}
            >
              {user.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
