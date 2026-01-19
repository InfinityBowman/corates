import { For, Show, createEffect } from 'solid-js';
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
 * @param {boolean} [props.isSkippable] - Whether this question can be skipped (scoring already determined)
 */
export function SignallingQuestion(props) {
  const options = () => getResponseOptions(props.question.responseType);

  createEffect(() => {
    // Only coerce NA to NI if NA is not a valid option for this question's response type
    if (props.answer?.answer === 'NA' && !options().includes('NA')) {
      props.onUpdate({
        ...props.answer,
        answer: 'NI',
      });
    }
  });

  function handleAnswerChange(value) {
    // Toggle off if clicking the already-selected option
    const newValue = props.answer?.answer === value ? null : value;
    props.onUpdate({
      ...props.answer,
      answer: newValue,
    });
  }

  const commentYText = () => {
    if (!props.showComment || !props.getRobinsText || !props.domainKey || !props.questionKey) {
      return null;
    }
    return props.getRobinsText(props.domainKey, 'comment', props.questionKey);
  };

  return (
    <div
      class={`border-border-subtle border-b py-3 last:border-b-0 ${props.isSkippable ? 'opacity-50' : ''}`}
    >
      <div class='flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4'>
        {/* Question number and text */}
        <div class='min-w-0 flex-1'>
          <span class='text-secondary-foreground text-sm font-medium'>{props.question.number}</span>
          <span class='text-muted-foreground ml-2 text-sm'>{props.question.text}</span>
          {props.question.note && (
            <span class='text-muted-foreground/70 ml-2 text-xs'>({props.question.note})</span>
          )}
          <Show when={props.isSkippable}>
            <span class='ml-2 text-xs text-green-600'>(Optional)</span>
          </Show>
        </div>

        {/* Response options */}
        <div class='flex shrink-0 flex-wrap gap-1 sm:gap-2'>
          <For each={options()}>
            {option => (
              <button
                type='button'
                onClick={() => !props.disabled && handleAnswerChange(option)}
                disabled={props.disabled}
                class={`relative inline-flex cursor-pointer items-center justify-center rounded border px-2 py-1 text-xs font-medium transition-colors ${props.disabled ? 'cursor-not-allowed opacity-50' : ''} ${
                  props.answer?.answer === option ?
                    'border-blue-400 bg-blue-100 text-blue-800'
                  : 'border-border bg-muted text-muted-foreground hover:bg-secondary'
                } `}
                title={RESPONSE_LABELS[option]}
              >
                {option}
              </button>
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
    <div class='bg-muted mb-4 rounded-lg p-3'>
      <div class='text-secondary-foreground mb-2 text-xs font-medium'>Response Legend</div>
      <div class='text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs'>
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
