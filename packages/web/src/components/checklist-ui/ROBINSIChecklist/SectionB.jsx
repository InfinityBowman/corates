import { For, Show, createMemo, createUniqueId } from 'solid-js';
import { SECTION_B, RESPONSE_LABELS } from '@/ROBINS-I/checklist-map.js';
import { shouldStopAssessment } from '@/ROBINS-I/checklist.js';
import { FiAlertCircle } from 'solid-icons/fi';

/**
 * Section B: Decide whether to proceed with risk-of-bias assessment
 * @param {Object} props
 * @param {Object} props.sectionBState - Current section B state
 * @param {Function} props.onUpdate - Callback when section B state changes
 * @param {boolean} [props.disabled] - Whether the section is disabled
 */
export function SectionB(props) {
  const uniqueId = createUniqueId();
  const stopAssessment = createMemo(() => shouldStopAssessment(props.sectionBState));

  function handleAnswerChange(questionKey, value) {
    const newState = {
      ...props.sectionBState,
      [questionKey]: {
        ...props.sectionBState[questionKey],
        answer: value,
      },
    };
    // Update stopAssessment flag
    newState.stopAssessment = shouldStopAssessment(newState);
    props.onUpdate(newState);
  }

  function handleCommentChange(questionKey, value) {
    props.onUpdate({
      ...props.sectionBState,
      [questionKey]: {
        ...props.sectionBState[questionKey],
        comment: value,
      },
    });
  }

  const responseOptions = ['Y', 'PY', 'PN', 'N'];

  return (
    <div class='bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden'>
      <div class='px-6 py-4 bg-gray-50 border-b border-gray-200'>
        <h3 class='font-semibold text-gray-900 text-base'>
          Section B: Decide Whether to Proceed With Risk-of-Bias Assessment
        </h3>
        <p class='text-xs text-gray-500 mt-1'>
          If B2 or B3 is Yes/Probably Yes, the result is classified as Critical risk of bias.
        </p>
      </div>

      <div class='px-6 py-4'>
        <For each={Object.entries(SECTION_B)}>
          {([key, question]) => (
            <div class='py-4 border-b border-gray-200 last:border-b-0'>
              <div class='flex flex-col gap-2'>
                {/* Question text */}
                <div class='text-sm text-gray-700'>
                  <span class='font-medium'>{key.toUpperCase()}.</span>
                  <span class='ml-1'>{question.text}</span>
                </div>

                {/* Info hint if present */}
                <Show when={question.info}>
                  <p class='text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200'>
                    {question.info}
                  </p>
                </Show>

                {/* Response options */}
                <div class='flex flex-wrap gap-2'>
                  <For each={responseOptions}>
                    {option => (
                      <label
                        class={`
                          inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium
                          cursor-pointer transition-all duration-200 border-2
                          ${props.disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-blue-300'}
                          focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-1
                          ${
                            props.sectionBState?.[key]?.answer === option ?
                              'bg-blue-50 border-blue-400 text-blue-800'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-blue-50'
                          }
                        `}
                      >
                        <input
                          type='radio'
                          name={`sectionB-${uniqueId}-${key}`}
                          value={option}
                          checked={props.sectionBState?.[key]?.answer === option}
                          onChange={() => handleAnswerChange(key, option)}
                          disabled={props.disabled}
                          class='hidden'
                        />
                        <span class='mr-1'>{option}</span>
                        <span class='text-xs opacity-70'>({RESPONSE_LABELS[option]})</span>
                      </label>
                    )}
                  </For>
                </div>

                {/* Comment field */}
                <input
                  type='text'
                  placeholder='Comment (optional)'
                  value={props.sectionBState?.[key]?.comment || ''}
                  onInput={e => handleCommentChange(key, e.target.value)}
                  disabled={props.disabled}
                  class='w-full pl-3 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition disabled:bg-gray-50 disabled:text-gray-500'
                />
              </div>
            </div>
          )}
        </For>

        {/* Stop assessment warning */}
        <Show when={stopAssessment()}>
          <div class='mt-5 bg-red-50 border-2 border-red-200 rounded-lg p-4'>
            <div class='flex items-center gap-2'>
              <FiAlertCircle class='w-5 h-5 text-red-600' />
              <span class='font-semibold text-red-800'>Assessment Stopped</span>
            </div>
            <p class='text-sm text-red-700 mt-2'>
              Based on the responses to B2 or B3, this result should be classified as
              <span class='font-semibold'> Critical risk of bias</span>. Further domain assessment
              is not required.
            </p>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default SectionB;
