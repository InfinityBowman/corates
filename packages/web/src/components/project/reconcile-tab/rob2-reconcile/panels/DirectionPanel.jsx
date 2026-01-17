import { Show, For } from 'solid-js';
import { BIAS_DIRECTIONS } from '@corates/shared/checklists/rob2';

/**
 * Get highlighted background color for selected direction
 * @returns {string} Tailwind CSS classes
 */
function getSelectedStyle() {
  return 'border-blue-400 bg-blue-50 text-blue-800';
}

/**
 * Panel for displaying/selecting bias direction
 *
 * @param {Object} props
 * @param {string} props.title - Panel title (e.g., "Reviewer 1", "Final Direction")
 * @param {string} props.panelType - 'reviewer1', 'reviewer2', or 'final'
 * @param {string} props.direction - The selected direction value
 * @param {boolean} props.readOnly - If true, inputs are disabled
 * @param {boolean} props.hideUseThis - Hide the "Use This" button
 * @param {boolean} props.isSelected - If true, this panel is the selected source
 * @param {Function} props.onDirectionChange - Callback when direction changes (direction) => void
 * @param {Function} props.onUseThis - Callback when "Use This" is clicked
 * @returns {JSX.Element}
 */
export default function DirectionPanel(props) {
  const isFinal = () => props.panelType === 'final';

  return (
    <div class='p-4'>
      {/* Panel Header */}
      <div class='mb-4 flex items-center justify-between'>
        <h3 class='font-semibold text-gray-900'>{props.title}</h3>
        <Show when={!isFinal() && !props.hideUseThis}>
          <button
            onClick={() => props.onUseThis?.()}
            class={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              props.isSelected
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
            }`}
          >
            {props.isSelected ? 'Selected' : 'Use This'}
          </button>
        </Show>
      </div>

      {/* Direction Options */}
      <div class='flex flex-col gap-2'>
        <For each={[...BIAS_DIRECTIONS]}>
          {option => {
            const isSelected = () => props.direction === option;
            const baseClasses =
              'flex items-center rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all';

            return (
              <Show
                when={!props.readOnly}
                fallback={
                  <div
                    class={`${baseClasses} ${
                      isSelected()
                        ? getSelectedStyle()
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    <span>{option}</span>
                  </div>
                }
              >
                <label
                  class={`${baseClasses} cursor-pointer focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-1 focus-within:outline-none hover:border-blue-300 ${
                    isSelected()
                      ? getSelectedStyle()
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-blue-50'
                  }`}
                >
                  <input
                    type='radio'
                    name={`${props.title}-direction`}
                    value={option}
                    checked={isSelected()}
                    onChange={() => props.onDirectionChange?.(option)}
                    class='hidden'
                  />
                  <span>{option}</span>
                </label>
              </Show>
            );
          }}
        </For>
      </div>

      {/* Selected Badge (for reviewer panels) */}
      <Show when={!isFinal() && props.direction}>
        <div class='mt-4 flex items-center gap-2'>
          <span class='text-xs text-gray-500'>Selected:</span>
          <span
            class={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getSelectedStyle()}`}
          >
            {props.direction}
          </span>
        </div>
      </Show>
    </div>
  );
}
