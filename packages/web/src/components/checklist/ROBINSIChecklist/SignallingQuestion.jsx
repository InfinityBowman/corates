import { For, createEffect, createUniqueId } from 'solid-js';
import { RESPONSE_LABELS, getResponseOptions } from './checklist-map.js';
import NoteEditor from '@/components/checklist/common/NoteEditor.jsx';

/**
 * A single signalling question with radio button options
 * @param {Object} props
 * @param {Object} props.question - Question definition from checklist-map
 * @param {Object} props.answer - Current answer state { answer, comment }
 * @param {Function} props.onUpdate - Callback when answer changes
 * @param {boolean} [props.disabled] - Whether the question is disabled
 * @param {boolean} [props.showComment] - Whether to show comment field
 * @param {string} [props.domainKey] - Domain key (e.g., 'domain1a') for comment Y.Text lookup
 * @param {string} [props.questionKey] - Question key for comment Y.Text lookup
 * @param {Function} [props.getRobinsText] - Function to get Y.Text for a ROBINS-I free-text field
 */
export function SignallingQuestion(props) {
  const uniqueId = createUniqueId();
  const options = () => getResponseOptions(props.question.responseType);

  createEffect(() => {
    if (props.answer?.answer === 'NA') {
      // Legacy answer value; NA is not a valid option for ROBINS-I in CoRATES.
      // We coerce it to NI so the UI remains consistent and scoring doesn't get stuck.
      props.onUpdate({
        ...props.answer,
        answer: 'NI',
      });
    }
  });

  function handleAnswerChange(value) {
    props.onUpdate({
      ...props.answer,
      answer: value,
    });
  }

  const commentYText = () => {
    if (!props.showComment || !props.getRobinsText || !props.domainKey || !props.questionKey) {
      return null;
    }
    return props.getRobinsText(props.domainKey, 'comment', props.questionKey);
  };

  return (
    <div class='border-b border-gray-100 py-3 last:border-b-0'>
      <div class='flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4'>
        {/* Question number and text */}
        <div class='min-w-0 flex-1'>
          <span class='text-sm font-medium text-gray-700'>{props.question.number}</span>
          <span class='ml-2 text-sm text-gray-600'>{props.question.text}</span>
          {props.question.note && (
            <span class='ml-2 text-xs text-gray-400'>({props.question.note})</span>
          )}
        </div>

        {/* Response options */}
        <div class='flex shrink-0 flex-wrap gap-1 sm:gap-2'>
          <For each={options()}>
            {option => (
              <label
                class={`relative inline-flex cursor-pointer items-center justify-center rounded border px-2 py-1 text-xs font-medium transition-colors ${props.disabled ? 'cursor-not-allowed opacity-50' : ''} ${
                  props.answer?.answer === option ?
                    'border-blue-400 bg-blue-100 text-blue-800'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                } `}
              >
                <input
                  type='radio'
                  name={`q-${uniqueId}-${props.question.id}`}
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
          <NoteEditor
            yText={commentYText()}
            placeholder='Comment (optional)'
            readOnly={props.disabled}
            inline={true}
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
  const commonResponses = ['Y', 'PY', 'PN', 'N', 'NI', 'WN', 'SN', 'SY', 'WY'];

  return (
    <div class='mb-4 rounded-lg bg-gray-50 p-3'>
      <div class='mb-2 text-xs font-medium text-gray-700'>Response Legend</div>
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
