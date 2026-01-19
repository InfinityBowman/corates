import { Show, For } from 'solid-js';
import { BIAS_DIRECTIONS } from '@/components/checklist/ROBINSIChecklist/checklist-map.js';

/**
 * Get button style for direction options
 * @param {boolean} isSelected - Whether this option is selected
 * @returns {string} Tailwind CSS classes
 */
function getDirectionButtonStyle(isSelected) {
  if (!isSelected) {
    return 'border-border bg-card text-secondary-foreground hover:bg-muted';
  }
  return 'border-blue-400 bg-blue-50 text-blue-800';
}

/**
 * Panel for displaying/selecting bias direction
 *
 * @param {Object} props
 * @param {string} props.title - Panel title
 * @param {string} props.panelType - 'reviewer1', 'reviewer2', or 'final'
 * @param {string} props.direction - Current direction value
 * @param {Array} props.directionOptions - Available direction options (defaults to BIAS_DIRECTIONS)
 * @param {boolean} props.readOnly - If true, inputs are disabled
 * @param {boolean} props.hideUseThis - Hide the "Use This" button
 * @param {boolean} props.isSelected - If true, this panel is the selected source
 * @param {Function} props.onDirectionChange - (direction) => void
 * @param {Function} props.onUseThis - Callback when "Use This" is clicked
 * @returns {JSX.Element}
 */
export default function DirectionPanel(props) {
  const isFinal = () => props.panelType === 'final';
  const options = () => props.directionOptions || BIAS_DIRECTIONS;

  return (
    <div class='p-4'>
      {/* Panel Header */}
      <div class='mb-4 flex items-center justify-between'>
        <h3 class='text-foreground font-semibold'>{props.title}</h3>
        <Show when={!isFinal() && !props.hideUseThis}>
          <button
            onClick={() => props.onUseThis?.()}
            class={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              props.isSelected ? 'bg-blue-600 text-white' : (
                'bg-secondary text-secondary-foreground hover:bg-blue-100 hover:text-blue-700'
              )
            }`}
          >
            {props.isSelected ? 'Selected' : 'Use This'}
          </button>
        </Show>
      </div>

      {/* Direction Badge (for reviewer panels) */}
      <Show when={!isFinal()}>
        <div class='mb-4 flex flex-wrap items-center gap-2'>
          <span class='text-muted-foreground text-xs'>Direction:</span>
          <span class='border-border bg-secondary text-secondary-foreground inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium'>
            {props.direction || 'Not set'}
          </span>
        </div>
      </Show>

      {/* Direction Options */}
      <div class='space-y-2'>
        <label class='text-secondary-foreground mb-1 block text-xs font-medium'>
          Predicted Direction of Bias
        </label>
        <For each={options()}>
          {option => {
            const isSelected = () => props.direction === option;
            const baseClasses =
              'w-full rounded-lg border-2 px-3 py-2 text-left text-sm font-medium transition-all';

            return (
              <Show
                when={!props.readOnly}
                fallback={
                  <div class={`${baseClasses} ${getDirectionButtonStyle(isSelected())}`}>
                    {option}
                  </div>
                }
              >
                <button
                  type='button'
                  onClick={() => props.onDirectionChange?.(option)}
                  class={`${baseClasses} cursor-pointer hover:border-blue-300 ${getDirectionButtonStyle(isSelected())}`}
                >
                  {option}
                </button>
              </Show>
            );
          }}
        </For>
      </div>
    </div>
  );
}
