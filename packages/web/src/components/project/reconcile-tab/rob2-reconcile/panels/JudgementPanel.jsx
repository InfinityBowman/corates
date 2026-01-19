import { Show } from 'solid-js';
import { JUDGEMENTS } from '@corates/shared/checklists/rob2';

/**
 * Get badge color for ROB-2 judgement
 * @param {string} judgement - The judgement value
 * @returns {string} Tailwind CSS classes for badge styling
 */
function getJudgementBadgeStyle(judgement) {
  switch (judgement) {
    case JUDGEMENTS.LOW:
    case 'Low':
      return 'bg-green-100 text-green-800 border-green-300';
    case JUDGEMENTS.SOME_CONCERNS:
    case 'Some concerns':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case JUDGEMENTS.HIGH:
    case 'High':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-secondary text-muted-foreground border-border';
  }
}

/**
 * Panel for displaying auto-calculated ROB-2 judgement
 * This is read-only - judgements are computed from signalling questions
 *
 * @param {Object} props
 * @param {string} props.title - Panel title (e.g., "Reviewer 1", "Final")
 * @param {string} props.panelType - 'reviewer1', 'reviewer2', or 'final'
 * @param {string} props.judgement - The judgement value (Low, Some concerns, High)
 * @param {string} props.ruleId - The scoring rule ID that produced this judgement
 * @param {boolean} props.isComplete - Whether the domain scoring is complete
 * @param {boolean} props.showRuleId - Whether to display the rule ID
 * @returns {JSX.Element}
 */
export default function JudgementPanel(props) {
  return (
    <div class='p-4'>
      {/* Panel Header */}
      <div class='mb-4'>
        <h3 class='text-foreground font-semibold'>{props.title}</h3>
      </div>

      {/* Judgement Badge */}
      <div class='flex flex-col items-start gap-3'>
        <Show
          when={props.judgement}
          fallback={
            <div class='flex items-center gap-2'>
              <div class='bg-border h-4 w-4 animate-pulse rounded-full' />
              <span class='text-muted-foreground text-sm italic'>
                {props.isComplete === false ? 'Not yet calculated' : 'Not available'}
              </span>
            </div>
          }
        >
          <span
            class={`inline-flex items-center rounded-lg border-2 px-4 py-2 text-sm font-semibold ${getJudgementBadgeStyle(props.judgement)}`}
          >
            {props.judgement}
          </span>
        </Show>

        {/* Rule ID (for debugging/transparency) */}
        <Show when={props.showRuleId && props.ruleId}>
          <div class='text-muted-foreground/70 text-xs'>Rule: {props.ruleId}</div>
        </Show>

        {/* Auto-calculated indicator */}
        <div class='text-muted-foreground flex items-center gap-1.5 text-xs'>
          <svg class='h-3.5 w-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path
              stroke-linecap='round'
              stroke-linejoin='round'
              stroke-width='2'
              d='M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z'
            />
          </svg>
          <span>Auto-calculated</span>
        </div>
      </div>
    </div>
  );
}
