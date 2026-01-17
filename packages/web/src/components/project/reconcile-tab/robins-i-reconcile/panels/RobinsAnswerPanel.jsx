import { Show, For } from 'solid-js';
import { RESPONSE_LABELS } from '@/components/checklist/ROBINSIChecklist/checklist-map.js';
import NoteEditor from '@/components/checklist/common/NoteEditor.jsx';

/**
 * Get badge color for Robins-I answer type
 * @param {string} answer - The answer code (Y, PY, PN, N, NI, etc.)
 * @returns {string} Tailwind CSS classes for badge styling
 */
function getAnswerBadgeStyle(answer) {
  switch (answer) {
    case 'Y':
    case 'SY':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'PY':
    case 'WY':
      return 'bg-lime-100 text-lime-800 border-lime-200';
    case 'PN':
    case 'WN':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'N':
    case 'SN':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'NI':
      return 'bg-gray-100 text-gray-600 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

/**
 * Get highlighted background color for selected answer
 * @returns {string} Tailwind CSS classes
 */
function getSelectedAnswerStyle() {
  return 'border-blue-400 bg-blue-50 text-blue-800';
}

/**
 * Panel showing one version of answers (reviewer or final) for Robins-I
 * Simpler than AMSTAR2 - single radio group with response codes + comment
 *
 * @param {Object} props
 * @param {string} props.title - Panel title (e.g., "Reviewer 1", "Final Answer")
 * @param {string} props.panelType - 'reviewer1', 'reviewer2', or 'final'
 * @param {string} props.answer - The selected answer code (Y, PY, PN, N, etc.)
 * @param {string} props.comment - The comment text (for reviewer panels, read-only display)
 * @param {Y.Text} props.commentYText - Y.Text instance for the final panel's comment (collaborative editing)
 * @param {Array} props.responseOptions - Array of response codes ['Y', 'PY', 'PN', 'N']
 * @param {boolean} props.readOnly - If true, inputs are disabled
 * @param {boolean} props.hideUseThis - Hide the "Use This" button
 * @param {boolean} props.isSelected - If true, this panel is the selected source
 * @param {Function} props.onAnswerChange - Callback when answer changes (answer) => void
 * @param {Function} props.onUseThis - Callback when "Use This" is clicked
 * @returns {JSX.Element}
 */
export default function RobinsAnswerPanel(props) {
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
              props.isSelected ? 'bg-blue-600 text-white' : (
                'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
              )
            }`}
          >
            {props.isSelected ? 'Selected' : 'Use This'}
          </button>
        </Show>
      </div>

      {/* Response Options */}
      <div class='mb-4 flex flex-wrap gap-2'>
        <For each={props.responseOptions}>
          {option => {
            const isSelected = () => props.answer === option;
            const baseClasses =
              'inline-flex items-center justify-center rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all';

            return (
              <Show
                when={!props.readOnly}
                fallback={
                  <div
                    class={`${baseClasses} ${
                      isSelected() ? getSelectedAnswerStyle() : (
                        'border-gray-200 bg-white text-gray-700'
                      )
                    }`}
                  >
                    <span class='mr-1'>{option}</span>
                    <span class='text-xs opacity-70'>({RESPONSE_LABELS[option]})</span>
                  </div>
                }
              >
                <label
                  class={`${baseClasses} cursor-pointer focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-1 focus-within:outline-none hover:border-blue-300 ${
                    isSelected() ? getSelectedAnswerStyle() : (
                      'border-gray-200 bg-white text-gray-700 hover:bg-blue-50'
                    )
                  }`}
                >
                  <input
                    type='radio'
                    name={`${props.title}-answer`}
                    value={option}
                    checked={isSelected()}
                    onChange={() => props.onAnswerChange?.(option)}
                    class='hidden'
                  />
                  <span class='mr-1'>{option}</span>
                  <span class='text-xs opacity-70'>({RESPONSE_LABELS[option]})</span>
                </label>
              </Show>
            );
          }}
        </For>
      </div>

      {/* Result Badge (for reviewer panels) */}
      <Show when={!isFinal() && props.answer}>
        <div class='mb-4 flex flex-wrap items-center gap-2'>
          <span class='text-xs text-gray-500'>Selected:</span>
          <span
            class={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getAnswerBadgeStyle(props.answer)}`}
          >
            {props.answer} - {RESPONSE_LABELS[props.answer]}
          </span>
        </div>
      </Show>

      {/* Comment Section */}
      <div class='mt-4'>
        <label class='mb-1 block text-xs font-medium text-gray-700'>
          {isFinal() ? 'Final Comment' : 'Comment'}
        </label>
        <Show
          when={!props.readOnly}
          fallback={
            <div class='rounded-lg border border-gray-200 bg-gray-50 p-3'>
              <p class='text-sm whitespace-pre-wrap text-gray-700'>
                {props.comment || <span class='text-gray-400 italic'>No comment</span>}
              </p>
            </div>
          }
        >
          {/* Final panel uses NoteEditor with Y.Text for collaborative editing */}
          <NoteEditor
            yText={props.commentYText}
            placeholder='Add the final reconciled comment...'
            readOnly={false}
            inline={true}
            focusRingColor='blue-400'
          />
        </Show>
      </div>
    </div>
  );
}
