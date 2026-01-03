import { For, Show, createMemo, createUniqueId } from 'solid-js';
import { SECTION_B, RESPONSE_LABELS } from './checklist-map.js';
import { shouldStopAssessment } from './checklist.js';
import { FiAlertCircle } from 'solid-icons/fi';
import NoteEditor from '@/components/checklist/common/NoteEditor.jsx';

/**
 * Section B: Decide whether to proceed with risk-of-bias assessment
 * @param {Object} props
 * @param {Object} props.sectionBState - Current section B state
 * @param {Function} props.onUpdate - Callback when section B state changes
 * @param {boolean} [props.disabled] - Whether the section is disabled
 * @param {Function} [props.getRobinsText] - Function to get Y.Text for a ROBINS-I free-text field
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

  const responseOptions = ['Y', 'PY', 'PN', 'N'];

  return (
    <div class='overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'>
      <div class='border-b border-gray-200 bg-gray-50 px-6 py-4'>
        <h3 class='text-base font-semibold text-gray-900'>
          Section B: Decide Whether to Proceed With Risk-of-Bias Assessment
        </h3>
        <p class='mt-1 text-xs text-gray-500'>
          If B2 or B3 is Yes/Probably Yes, the result is classified as Critical risk of bias.
        </p>
      </div>

      <div class='px-6 py-4'>
        <For each={Object.entries(SECTION_B)}>
          {([key, question]) => (
            <div class='border-b border-gray-200 py-4 last:border-b-0'>
              <div class='flex flex-col gap-2'>
                {/* Question text */}
                <div class='text-sm text-gray-700'>
                  <span class='font-medium'>{key.toUpperCase()}.</span>
                  <span class='ml-1'>{question.text}</span>
                </div>

                {/* Info hint if present */}
                <Show when={question.info}>
                  <p class='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700'>
                    {question.info}
                  </p>
                </Show>

                {/* Response options */}
                <div class='flex flex-wrap gap-2'>
                  <For each={responseOptions}>
                    {option => (
                      <label
                        class={`inline-flex cursor-pointer items-center justify-center rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all duration-200 ${props.disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-blue-300'} focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-1 focus-within:outline-none ${
                          props.sectionBState?.[key]?.answer === option ?
                            'border-blue-400 bg-blue-50 text-blue-800'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-blue-50'
                        } `}
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
                <div class='mt-2'>
                  <NoteEditor
                    yText={
                      props.getRobinsText ? props.getRobinsText('sectionB', 'comment', key) : null
                    }
                    placeholder='Comment (optional)'
                    readOnly={props.disabled}
                    inline={true}
                  />
                </div>
              </div>
            </div>
          )}
        </For>

        {/* Stop assessment warning */}
        <Show when={stopAssessment()}>
          <div class='mt-5 rounded-lg border-2 border-red-200 bg-red-50 p-4'>
            <div class='flex items-center gap-2'>
              <FiAlertCircle class='h-5 w-5 text-red-600' />
              <span class='font-semibold text-red-800'>Assessment Stopped</span>
            </div>
            <p class='mt-2 text-sm text-red-700'>
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
