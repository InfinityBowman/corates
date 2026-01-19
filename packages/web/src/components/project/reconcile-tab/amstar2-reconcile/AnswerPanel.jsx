import { Show, For } from 'solid-js';
import { AMSTAR_CHECKLIST } from '@/components/checklist/AMSTAR2Checklist/checklist-map.js';

/**
 * Get badge color for answer type
 * @param {string} answer - The answer type
 * @returns {string} The badge color style
 */
function getAnswerBadgeStyle(answer) {
  switch (answer) {
    case 'Yes':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'Partial Yes':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'No':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'No MA':
    case 'Includes only NRSI':
    case 'Includes only RCTs':
      return 'bg-secondary text-muted-foreground border-border';
    default:
      return 'bg-secondary text-muted-foreground border-border';
  }
}

/**
 * Panel showing one version of answers (reviewer or final)
 * @param {Object} props
 * @param {string} props.questionKey
 * @param {Array} props.columns
 * @param {Array} props.answers
 * @param {boolean} props.compact
 * @param {boolean} props.isFinal
 * @param {Function} props.onCheckboxChange
 * @param {Function} props.onRadioChange
 * @param {string} props.selectedSource
 * @param {boolean} props.hideSelectButtons
 * @param {boolean} props.readOnly
 * @param {string} props.panelId
 * @param {string} props.title
 * @param {string} props.finalAnswer
 * @param {boolean} props.isSelected
 * @returns {JSX.Element}
 */
export default function AnswerPanel(props) {
  const question = () => AMSTAR_CHECKLIST[props.questionKey];
  // Use passed columns if provided, otherwise get from question
  const columns = () => props.columns || question()?.columns || [];
  const answers = () => props.answers?.answers || [];

  return (
    <Show
      when={!props.compact}
      fallback={
        <div class='space-y-3'>
          <For each={columns()}>
            {(col, colIdx) => {
              const isLastColumn = () => colIdx() === columns().length - 1;
              const colAnswers = () => answers()[colIdx()] || [];

              return (
                <div class='border-border border-t pt-2 first:border-t-0 first:pt-0'>
                  <Show when={col.label}>
                    <div class='text-secondary-foreground mb-1 text-xs font-semibold'>
                      {col.label}
                    </div>
                  </Show>
                  <div class='space-y-1'>
                    <For each={col.options}>
                      {(option, optIdx) => {
                        const isChecked = () => colAnswers()[optIdx()] === true;

                        return (
                          <label
                            class={`flex items-start gap-2 text-xs ${props.readOnly ? '' : 'hover:bg-muted -m-1 cursor-pointer rounded p-1'}`}
                          >
                            <Show
                              when={isLastColumn()}
                              fallback={
                                <input
                                  type='checkbox'
                                  checked={isChecked()}
                                  disabled={props.readOnly}
                                  onChange={() =>
                                    !props.readOnly && props.onCheckboxChange?.(colIdx(), optIdx())
                                  }
                                  class='border-border focus:ring-primary mt-0.5 h-3 w-3 shrink-0 rounded text-blue-600'
                                />
                              }
                            >
                              <input
                                type='radio'
                                name={`${props.panelId || props.title || 'panel'}-${props.questionKey}-compact-${colIdx()}`}
                                checked={isChecked()}
                                disabled={props.readOnly}
                                onChange={() =>
                                  !props.readOnly && props.onRadioChange?.(colIdx(), optIdx())
                                }
                                class='border-border focus:ring-primary mt-0.5 h-3 w-3 shrink-0 text-blue-600'
                              />
                            </Show>
                            <span
                              class={`text-xs ${isChecked() ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
                            >
                              {option}
                            </span>
                          </label>
                        );
                      }}
                    </For>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      }
    >
      <div class='p-4'>
        {/* Panel Header */}
        <div class={`${props.isFinal ? 'mb-0' : 'mb-4'} flex items-center justify-between`}>
          <div>
            <h3 class='text-foreground -mb-1 font-semibold'>{props.title}</h3>
            <Show when={props.isFinal && props.selectedSource}>
              <span class='text-muted-foreground text-xs'>
                {props.selectedSource === 'custom' ?
                  'Custom selection'
                : `Based on ${props.selectedSource === 'reviewer1' ? 'Reviewer 1' : 'Reviewer 2'}`}
              </span>
            </Show>
          </div>
          <Show when={!props.isFinal && !props.hideSelectButtons}>
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

        {/* Final Answer Badge */}
        <div class='mb-4 flex flex-wrap items-center gap-2'>
          <span class='text-muted-foreground text-xs'>Result:</span>
          <span
            class={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getAnswerBadgeStyle(props.finalAnswer)}`}
          >
            {props.finalAnswer || 'Not selected'}
          </span>
        </div>

        {/* Answer Columns */}
        <div class='space-y-4'>
          <For each={columns()}>
            {(col, colIdx) => {
              const isLastColumn = () => colIdx() === columns().length - 1;
              const colAnswers = () => answers()[colIdx()] || [];

              return (
                <div class='border-border border-t pt-3'>
                  <Show when={col.label}>
                    <div class='text-secondary-foreground mb-2 text-xs font-semibold'>
                      {col.label}
                    </div>
                  </Show>
                  <Show when={col.description}>
                    <div class='text-muted-foreground mb-2 text-xs'>{col.description}</div>
                  </Show>

                  <div class='space-y-2'>
                    <For each={col.options}>
                      {(option, optIdx) => {
                        const isChecked = () => colAnswers()[optIdx()] === true;

                        return (
                          <label
                            class={`flex items-start gap-2 text-xs ${props.readOnly ? '' : 'hover:bg-muted -m-1 cursor-pointer rounded p-1'}`}
                          >
                            <Show
                              when={isLastColumn()}
                              fallback={
                                <input
                                  type='checkbox'
                                  checked={isChecked()}
                                  disabled={props.readOnly}
                                  onChange={() =>
                                    !props.readOnly && props.onCheckboxChange?.(colIdx(), optIdx())
                                  }
                                  class='border-border focus:ring-primary mt-0.5 h-3.5 w-3.5 shrink-0 rounded text-blue-600'
                                />
                              }
                            >
                              <input
                                type='radio'
                                name={`${props.title}-${props.questionKey}-final`}
                                checked={isChecked()}
                                disabled={props.readOnly}
                                onChange={() =>
                                  !props.readOnly && props.onRadioChange?.(colIdx(), optIdx())
                                }
                                class='border-border focus:ring-primary mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600'
                              />
                            </Show>
                            <span
                              class={`${isChecked() ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
                            >
                              {option}
                            </span>
                          </label>
                        );
                      }}
                    </For>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </Show>
  );
}
