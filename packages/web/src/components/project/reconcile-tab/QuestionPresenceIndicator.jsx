/**
 * QuestionPresenceIndicator - Colored rings on question pills showing who's viewing
 *
 * Features:
 * - Renders colored ring(s) around the parent element
 * - Supports multiple users with stacked rings
 * - Pulsing animation for visibility
 */

import { For, Show } from 'solid-js';

/**
 * @param {Object} props
 * @param {Array} props.users - Array of users viewing this question with { userId, color, name }
 * @param {number} [props.maxRings=2] - Maximum number of rings to show
 * @param {string} [props.size='md'] - Ring size: 'sm', 'md', 'lg'
 */
export default function QuestionPresenceIndicator(props) {
  const users = () => props.users ?? [];
  const maxRings = () => props.maxRings ?? 2;
  const visibleUsers = () => users().slice(0, maxRings());

  // Ring offsets for stacking effect
  const getOffset = index => {
    const offsets = {
      sm: 2,
      md: 3,
      lg: 4,
    };
    const base = offsets[props.size || 'md'] || 3;
    return index * base;
  };

  // Ring width - thicker for better visibility
  const getRingWidth = () => {
    const widths = {
      sm: 2,
      md: 3,
      lg: 4,
    };
    return widths[props.size || 'md'] || 3;
  };

  return (
    <Show when={users().length > 0}>
      <div class='pointer-events-none absolute inset-0'>
        <For each={visibleUsers()}>
          {(user, index) => (
            <div
              class='absolute inset-0 animate-pulse rounded-full'
              style={{
                margin: `-${getOffset(index())}px`,
                border: `${getRingWidth()}px solid ${user.color.hex}`,
                opacity: 0.85 - index() * 0.15,
                'box-shadow': `0 0 8px ${user.color.hex}50`,
              }}
            />
          )}
        </For>
      </div>
    </Show>
  );
}
