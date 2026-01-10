/**
 * ProgressCard - Shows overall progress with an SVG arc visualization
 */

import { createMemo, Show } from 'solid-js';

/**
 * SVG arc progress indicator
 * @param {Object} props
 * @param {number} props.completed - Number of completed items
 * @param {number} props.total - Total number of items
 * @param {string} [props.title] - Card title
 * @param {string} [props.subtitle] - Subtitle text
 */
export function ProgressCard(props) {
  const percentage = createMemo(() => {
    if (!props.total || props.total === 0) return 0;
    return Math.round((props.completed / props.total) * 100);
  });

  // SVG arc calculations
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = createMemo(() => {
    return circumference - (percentage() / 100) * circumference;
  });

  return (
    <div
      class='flex flex-col items-center rounded-xl border border-stone-200/60 bg-white p-6 text-center'
      style={{ animation: 'fade-up 0.6s ease-out 200ms backwards' }}
    >
      <h3 class='mb-4 text-sm font-medium text-stone-700'>{props.title || 'Overall Progress'}</h3>

      {/* SVG Arc */}
      <div class='relative mb-4'>
        <svg width='140' height='140' viewBox='0 0 140 140'>
          {/* Background arc */}
          <circle cx='70' cy='70' r={radius} stroke='#f5f5f4' stroke-width='12' fill='none' />
          {/* Progress arc */}
          <circle
            cx='70'
            cy='70'
            r={radius}
            stroke='#3b82f6'
            stroke-width='12'
            fill='none'
            stroke-linecap='round'
            stroke-dasharray={circumference}
            stroke-dashoffset={strokeDashoffset()}
            transform='rotate(-90 70 70)'
            class='transition-all duration-700 ease-out'
          />
        </svg>
        {/* Center text */}
        <div class='absolute inset-0 flex flex-col items-center justify-center'>
          <span class='text-3xl font-bold text-stone-800 tabular-nums'>{percentage()}%</span>
          <span class='text-xs text-stone-500'>complete</span>
        </div>
      </div>

      {/* Stats below */}
      <div class='flex items-center gap-4 text-sm'>
        <div class='flex items-center gap-1.5'>
          <span class='h-2 w-2 rounded-full bg-blue-500' />
          <span class='text-stone-600'>{props.completed} done</span>
        </div>
        <div class='flex items-center gap-1.5'>
          <span class='h-2 w-2 rounded-full bg-stone-200' />
          <span class='text-stone-600'>{props.total - props.completed} remaining</span>
        </div>
      </div>

      <Show when={props.subtitle}>
        <p class='mt-3 text-xs text-stone-400'>{props.subtitle}</p>
      </Show>
    </div>
  );
}

export default ProgressCard;
