import { For } from 'solid-js';
import { RESPONSE_LABELS, getResponseOptions } from '@/ROBINS-I/checklist-map.js';

/**
 * A single signalling question with radio button options
 * @param {Object} props
 * @param {Object} props.question - Question definition from checklist-map
 * @param {Object} props.answer - Current answer state { answer, comment }
 * @param {Function} props.onUpdate - Callback when answer changes
 * @param {boolean} [props.disabled] - Whether the question is disabled
 * @param {boolean} [props.showComment] - Whether to show comment field
 */
export function SignallingQuestion(props) {
  const options = () => getResponseOptions(props.question.responseType);

  function handleAnswerChange(value) {
    props.onUpdate({
      ...props.answer,
      answer: value,
    });
  }

  function handleCommentChange(e) {
    props.onUpdate({
      ...props.answer,
      comment: e.target.value,
    });
  }

  return (
    <div class='py-3 border-b border-gray-100 last:border-b-0'>
      <div class='flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4'>
        {/* Question number and text */}
        <div class='flex-1 min-w-0'>
          <span class='font-medium text-gray-700 text-sm'>{props.question.number}</span>
          <span class='text-gray-600 text-sm ml-2'>{props.question.text}</span>
          {props.question.note && (
            <span class='text-gray-400 text-xs ml-2'>({props.question.note})</span>
          )}
        </div>

        {/* Response options */}
        <div class='flex flex-wrap gap-1 sm:gap-2 shrink-0'>
          <For each={options()}>
            {option => (
              <label
                class={`
                  inline-flex items-center justify-center px-2 py-1 rounded text-xs font-medium
                  cursor-pointer transition-colors border
                  ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                  ${
                    props.answer?.answer === option ?
                      'bg-blue-100 border-blue-400 text-blue-800'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                <input
                  type='radio'
                  name={`q-${props.question.id}`}
                  value={option}
                  checked={props.answer?.answer === option}
                  onChange={() => handleAnswerChange(option)}
                  disabled={props.disabled}
                  class='sr-only'
                />
                <span title={RESPONSE_LABELS[option]}>{option}</span>
              </label>
            )}
          </For>
        </div>
      </div>

      {/* Comment field (optional) */}
      {props.showComment && (
        <div class='mt-2'>
          <input
            type='text'
            placeholder='Comment (optional)'
            value={props.answer?.comment || ''}
            onInput={handleCommentChange}
            disabled={props.disabled}
            class='w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400'
          />
        </div>
      )}
    </div>
  );
}

/**
 * Response legend component showing what each abbreviation means
 */
export function ResponseLegend() {
  const commonResponses = ['Y', 'PY', 'PN', 'N', 'NI', 'NA', 'WN', 'SN', 'SY', 'WY'];

  return (
    <div class='bg-gray-50 rounded-lg p-3 mb-4'>
      <div class='text-xs font-medium text-gray-700 mb-2'>Response Legend</div>
      <div class='flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600'>
        <For each={commonResponses}>
          {code => (
            <span>
              <span class='font-medium'>{code}</span> = {RESPONSE_LABELS[code]}
            </span>
          )}
        </For>
      </div>
    </div>
  );
}

export default SignallingQuestion;
