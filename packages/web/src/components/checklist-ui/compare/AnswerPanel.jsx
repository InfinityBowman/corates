import { Show, For } from 'solid-js';
import { AMSTAR_CHECKLIST } from '@/AMSTAR2/checklist-map.js';

/**
 * Get badge color for answer type
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
      return 'bg-gray-100 text-gray-600 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

/**
 * Panel showing one version of answers (reviewer or final)
 */
export default function AnswerPanel(props) {
  const question = () => AMSTAR_CHECKLIST[props.questionKey];
  // Use passed columns if provided, otherwise get from question
  const columns = () => props.columns || question()?.columns || [];
  const answers = () => props.answers?.answers || [];
  const critical = () => props.answers?.critical ?? false;

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
                <div class='border-t border-gray-200 pt-2 first:border-t-0 first:pt-0'>
                  <Show when={col.label}>
                    <div class='text-xs font-semibold text-gray-700 mb-1'>{col.label}</div>
                  </Show>
                  <div class='space-y-1'>
                    <For each={col.options}>
                      {(option, optIdx) => {
                        const isChecked = () => colAnswers()[optIdx()] === true;

                        return (
                          <label
                            class={`flex items-start gap-2 text-xs ${props.readOnly ? '' : 'cursor-pointer hover:bg-gray-50 p-1 rounded -m-1'}`}
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
                                  class='w-3 h-3 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 shrink-0'
                                />
                              }
                            >
                              <input
                                type='radio'
                                name={`${props.questionKey}-compact-${colIdx()}`}
                                checked={isChecked()}
                                disabled={props.readOnly}
                                onChange={() =>
                                  !props.readOnly && props.onRadioChange?.(colIdx(), optIdx())
                                }
                                class='w-3 h-3 mt-0.5 text-blue-600 border-gray-300 focus:ring-blue-500 shrink-0'
                              />
                            </Show>
                            <span
                              class={`text-xs ${isChecked() ? 'text-gray-900 font-medium' : 'text-gray-600'}`}
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
      <div class={`p-4 ${props.isFinal ? 'bg-green-50/30' : ''}`}>
        {/* Panel Header */}
        <div class='flex items-center justify-between mb-4'>
          <div>
            <h3 class='font-semibold text-gray-900'>{props.title}</h3>
            <Show when={props.isFinal && props.selectedSource}>
              <span class='text-xs text-gray-500'>
                {props.selectedSource === 'custom' ?
                  'Custom selection'
                : `Based on ${props.selectedSource === 'reviewer1' ? 'Reviewer 1' : 'Reviewer 2'}`}
              </span>
            </Show>
          </div>
          <Show when={!props.isFinal}>
            <button
              onClick={() => props.onUseThis?.()}
              class={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                props.isSelected ? 'bg-blue-600 text-white' : (
                  'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
                )
              }`}
            >
              {props.isSelected ? 'Selected' : 'Use This'}
            </button>
          </Show>
        </div>

        {/* Final Answer Badge */}
        <div class='mb-4'>
          <span class='text-xs text-gray-500 block mb-1'>Result:</span>
          <span
            class={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${getAnswerBadgeStyle(props.finalAnswer)}`}
          >
            {props.finalAnswer || 'Not selected'}
          </span>
        </div>

        {/* Critical Toggle */}
        <div class='mb-4'>
          <div class='flex items-center gap-2'>
            <span class='text-xs text-gray-500'>Critical:</span>
            <span class={`text-xs font-medium ${critical() ? 'text-red-600' : 'text-gray-600'}`}>
              {critical() ? 'Yes' : 'No'}
            </span>
          </div>
        </div>

        {/* Answer Columns */}
        <div class='space-y-4'>
          <For each={columns()}>
            {(col, colIdx) => {
              const isLastColumn = () => colIdx() === columns().length - 1;
              const colAnswers = () => answers()[colIdx()] || [];

              return (
                <div class='border-t border-gray-200 pt-3'>
                  <Show when={col.label}>
                    <div class='text-xs font-semibold text-gray-700 mb-2'>{col.label}</div>
                  </Show>
                  <Show when={col.description}>
                    <div class='text-xs text-gray-500 mb-2'>{col.description}</div>
                  </Show>

                  <div class='space-y-2'>
                    <For each={col.options}>
                      {(option, optIdx) => {
                        const isChecked = () => colAnswers()[optIdx()] === true;

                        return (
                          <label
                            class={`flex items-start gap-2 text-xs ${props.readOnly ? '' : 'cursor-pointer hover:bg-gray-50 p-1 rounded -m-1'}`}
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
                                  class='w-3.5 h-3.5 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 shrink-0'
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
                                class='w-3.5 h-3.5 mt-0.5 text-blue-600 border-gray-300 focus:ring-blue-500 shrink-0'
                              />
                            </Show>
                            <span
                              class={`${isChecked() ? 'text-gray-900 font-medium' : 'text-gray-600'}`}
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
