import { Show, For } from 'solid-js';
import { ROB_JUDGEMENTS } from '@/components/checklist/ROBINSIChecklist/checklist-map.js';

/**
 * Get badge color for risk of bias judgement
 * @param {string} judgement - The judgement value
 * @returns {string} Tailwind CSS classes for badge styling
 */
function getJudgementBadgeStyle(judgement) {
  if (!judgement) return 'bg-secondary text-muted-foreground border-border';

  if (judgement.toLowerCase().includes('low')) {
    return 'bg-green-100 text-green-800 border-green-200';
  }
  if (judgement.toLowerCase().includes('moderate')) {
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }
  if (judgement.toLowerCase().includes('serious')) {
    return 'bg-orange-100 text-orange-800 border-orange-200';
  }
  if (judgement.toLowerCase().includes('critical')) {
    return 'bg-red-100 text-red-800 border-red-200';
  }
  return 'bg-secondary text-muted-foreground border-border';
}

/**
 * Get button style for judgement options
 * @param {boolean} isSelected - Whether this option is selected
 * @returns {string} Tailwind CSS classes
 */
function getJudgementButtonStyle(isSelected) {
  if (!isSelected) {
    return 'border-border bg-card text-secondary-foreground hover:bg-muted';
  }
  return 'border-blue-400 bg-blue-50 text-blue-800';
}

/**
 * Panel for displaying/selecting risk of bias judgement
 *
 * @param {Object} props
 * @param {string} props.title - Panel title
 * @param {string} props.panelType - 'reviewer1', 'reviewer2', or 'final'
 * @param {string} props.judgement - Current judgement value
 * @param {Array} props.judgementOptions - Available judgement options (defaults to ROB_JUDGEMENTS)
 * @param {boolean} props.readOnly - If true, inputs are disabled
 * @param {boolean} props.hideUseThis - Hide the "Use This" button
 * @param {boolean} props.isSelected - If true, this panel is the selected source
 * @param {Function} props.onJudgementChange - (judgement) => void
 * @param {Function} props.onUseThis - Callback when "Use This" is clicked
 * @returns {JSX.Element}
 */
export default function JudgementPanel(props) {
  const isFinal = () => props.panelType === 'final';
  const options = () => props.judgementOptions || ROB_JUDGEMENTS;

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

      {/* Judgement Badge (for reviewer panels) */}
      <Show when={!isFinal()}>
        <div class='mb-4 flex flex-wrap items-center gap-2'>
          <span class='text-muted-foreground text-xs'>Judgement:</span>
          <span
            class={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getJudgementBadgeStyle(props.judgement)}`}
          >
            {props.judgement || 'Not set'}
          </span>
        </div>
      </Show>

      {/* Judgement Options */}
      <div class='space-y-2'>
        <label class='text-secondary-foreground mb-1 block text-xs font-medium'>
          Risk of Bias Judgement
        </label>
        <For each={options()}>
          {option => {
            const isSelected = () => props.judgement === option;
            const baseClasses =
              'w-full rounded-lg border-2 px-3 py-2 text-left text-sm font-medium transition-all';

            return (
              <Show
                when={!props.readOnly}
                fallback={
                  <div class={`${baseClasses} ${getJudgementButtonStyle(isSelected())}`}>
                    {option}
                  </div>
                }
              >
                <button
                  type='button'
                  onClick={() => props.onJudgementChange?.(option)}
                  class={`${baseClasses} cursor-pointer hover:border-blue-300 ${getJudgementButtonStyle(isSelected())}`}
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
