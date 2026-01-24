/**
 * RemoteCursors - Floating cursor overlay showing other users' mouse positions
 *
 * Features:
 * - Renders colored cursor arrows with name labels
 * - Smooth position updates via CSS transforms
 * - Fades out stale cursors
 * - Handles scroll position differences
 */

import { For } from 'solid-js';

/**
 * Cursor icon SVG - Clean arrowhead pointer with rounded bottom
 */
function CursorIcon(props) {
  return (
    <svg
      width='20'
      height='24'
      viewBox='0 0 20 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.25))' }}
    >
      {/* Simple arrowhead */}
      <path
        d='M2 1L2 21L8 15L18 15L2 1Z'
        fill={props.color}
        stroke='white'
        stroke-width='1.5'
        stroke-linejoin='round'
      />
    </svg>
  );
}

/**
 * @param {Object} props
 * @param {Array} props.users - Array of users with cursor data { userId, name, cursor: { x, y, scrollY, timestamp }, color }
 *                              (already filtered by useReconciliationPresence for staleness)
 * @param {number} props.containerScrollY - Current scroll position of the container
 */
export default function RemoteCursors(props) {
  // Users are already filtered for staleness by useReconciliationPresence
  const activeCursors = () => props.users || [];

  // Calculate adjusted Y position based on scroll difference
  // cursor.y is the content position (viewport Y + scrollTop when recorded)
  // To display: convert content position to viewport position by subtracting local scroll
  const getAdjustedY = cursor => {
    const localScroll = props.containerScrollY ?? 0;
    // cursor.y is content position, subtract local scroll to get viewport position
    return cursor.y - localScroll;
  };

  return (
    <div class='pointer-events-none absolute inset-0' style={{ 'z-index': 9999 }}>
      <For each={activeCursors()}>
        {user => {
          const x = () => user.cursor.x;
          const y = () => getAdjustedY(user.cursor);

          return (
            <div
              class='absolute top-0 left-0'
              style={{
                transform: `translate(${x()}px, ${y()}px)`,
                'z-index': 9999,
                transition: 'transform 150ms ease-out',
              }}
            >
              {/* Cursor icon */}
              <CursorIcon color={user.color.hex} />

              {/* Name label */}
              <div
                class='-mt-1 ml-3 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-white shadow-sm'
                style={{
                  'background-color': user.color.hex,
                  'border-radius': '2px 6px 6px 6px',
                }}
              >
                {user.name}
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}
