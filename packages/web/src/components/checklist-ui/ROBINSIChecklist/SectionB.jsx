import { For, Show, createMemo } from 'solid-js';
import { SECTION_B, RESPONSE_LABELS } from '@/ROBINS-I/checklist-map.js';
import { shouldStopAssessment } from '@/ROBINS-I/checklist.js';

/**
 * Section B: Decide whether to proceed with risk-of-bias assessment
 * @param {Object} props
 * @param {Object} props.sectionBState - Current section B state
 * @param {Function} props.onUpdate - Callback when section B state changes
 * @param {boolean} [props.disabled] - Whether the section is disabled
 */
export function SectionB(props) {
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
    <div class="bg-white rounded-lg shadow-md overflow-hidden">
      <div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h3 class="font-semibold text-gray-900">
          Section B: Decide Whether to Proceed With Risk-of-Bias Assessment
        </h3>
        <p class="text-xs text-gray-500 mt-1">
          If B2 or B3 is Yes/Probably Yes, the result is classified as Critical risk of bias.
        </p>
      </div>

      <div class="px-6 py-4">
        <For each={Object.entries(SECTION_B)}>
          {([key, question]) => (
            <div class="py-3 border-b border-gray-100 last:border-b-0">
              <div class="flex flex-col gap-2">
                {/* Question text */}
                <div class="text-sm text-gray-700">
                  <span class="font-medium">{key.toUpperCase()}.</span>
                  <span class="ml-1">{question.text}</span>
                </div>

                {/* Info hint if present */}
                <Show when={question.info}>
                  <p class="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                    {question.info}
                  </p>
                </Show>

                {/* Response options */}
                <div class="flex flex-wrap gap-2">
                  <For each={responseOptions}>
                    {(option) => (
                      <label
                        class={`
                          inline-flex items-center justify-center px-3 py-1.5 rounded text-sm font-medium
                          cursor-pointer transition-colors border
                          ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                          ${props.sectionBState?.[key]?.answer === option
                            ? 'bg-blue-100 border-blue-400 text-blue-800'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                          }
                        `}
                      >
                        <input
                          type="radio"
                          name={`sectionB-${key}`}
                          value={option}
                          checked={props.sectionBState?.[key]?.answer === option}
                          onChange={() => handleAnswerChange(key, option)}
                          disabled={props.disabled}
                          class="sr-only"
                        />
                        <span class="mr-1">{option}</span>
                        <span class="text-xs opacity-70">({RESPONSE_LABELS[option]})</span>
                      </label>
                    )}
                  </For>
                </div>

                {/* Comment field */}
                <input
                  type="text"
                  placeholder="Comment (optional)"
                  value={props.sectionBState?.[key]?.comment || ''}
                  onInput={(e) => handleCommentChange(key, e.target.value)}
                  disabled={props.disabled}
                  class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
          )}
        </For>

        {/* Stop assessment warning */}
        <Show when={stopAssessment()}>
          <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
              <span class="font-semibold text-red-800">Assessment Stopped</span>
            </div>
            <p class="text-sm text-red-700 mt-2">
              Based on the responses to B2 or B3, this result should be classified as
              <span class="font-semibold"> Critical risk of bias</span>.
              Further domain assessment is not required.
            </p>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default SectionB;
