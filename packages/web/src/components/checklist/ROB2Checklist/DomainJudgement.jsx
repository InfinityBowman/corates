import { For, Show } from 'solid-js';
import { JUDGEMENTS, BIAS_DIRECTIONS } from './checklist-map.js';

/**
 * Judgement badge component for displaying risk of bias
 */
export function JudgementBadge(props) {
  const getColor = () => {
    switch (props.judgement) {
      case 'Low':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Some concerns':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'High':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  return (
    <span class={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${getColor()}`}>
      {props.judgement}
    </span>
  );
}

/**
 * Domain judgement selector component
 * @param {Object} props
 * @param {string} props.domainId - Domain identifier
 * @param {string|null} props.judgement - Current judgement value
 * @param {string|null} props.direction - Current direction of bias
 * @param {Function} props.onJudgementChange - Callback when judgement changes
 * @param {Function} props.onDirectionChange - Callback when direction changes
 * @param {boolean} [props.showDirection] - Whether to show direction selector
 * @param {boolean} [props.disabled] - Whether the selector is disabled
 * @param {boolean} [props.isAutoMode] - Whether in auto-scoring mode (read-only display)
 */
export function DomainJudgement(props) {
  const judgementOptions = Object.values(JUDGEMENTS);

  const getJudgementColor = (judgement, isSelected) => {
    if (!isSelected) {
      return props.isAutoMode ?
        'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 cursor-pointer';
    }

    switch (judgement) {
      case 'Low':
        return 'bg-green-100 border-green-400 text-green-800';
      case 'Some concerns':
        return 'bg-yellow-100 border-yellow-400 text-yellow-800';
      case 'High':
        return 'bg-red-100 border-red-400 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-600';
    }
  };

  return (
    <div class='space-y-4'>
      {/* Judgement buttons */}
      <div>
        <div class='mb-2 text-xs font-medium text-gray-600'>
          {props.isAutoMode ? 'Auto-calculated judgement' : 'Select judgement'}
        </div>
        <div class='flex flex-wrap gap-2'>
          <For each={judgementOptions}>
            {judgement => {
              const isSelected = () => props.judgement === judgement;
              return (
                <button
                  type='button'
                  onClick={() => {
                    if (props.disabled || props.isAutoMode) return;
                    props.onJudgementChange(isSelected() ? null : judgement);
                  }}
                  disabled={props.disabled || props.isAutoMode}
                  class={`inline-flex items-center justify-center rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                    props.disabled ? 'cursor-not-allowed opacity-50' : ''
                  } ${getJudgementColor(judgement, isSelected())}`}
                >
                  {judgement}
                </button>
              );
            }}
          </For>
        </div>
      </div>

      {/* Direction of bias (optional) */}
      <Show when={props.showDirection}>
        <div>
          <div class='mb-2 text-xs font-medium text-gray-600'>
            Predicted direction of bias
            <span class='ml-1 font-normal text-gray-400'>(optional)</span>
          </div>
          <div class='flex flex-wrap gap-1.5'>
            <For each={BIAS_DIRECTIONS}>
              {direction => {
                const isSelected = () => props.direction === direction;
                return (
                  <button
                    type='button'
                    onClick={() => {
                      if (props.disabled) return;
                      props.onDirectionChange(isSelected() ? null : direction);
                    }}
                    disabled={props.disabled}
                    class={`inline-flex items-center justify-center rounded border px-2 py-1 text-xs font-medium transition-colors ${
                      props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    } ${
                      isSelected() ?
                        'border-blue-400 bg-blue-100 text-blue-800'
                      : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {direction}
                  </button>
                );
              }}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default DomainJudgement;
