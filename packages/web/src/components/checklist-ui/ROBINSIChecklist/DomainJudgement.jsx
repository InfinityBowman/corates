import { For } from 'solid-js';
import { ROB_JUDGEMENTS, BIAS_DIRECTIONS, DOMAIN1_DIRECTIONS } from '@/ROBINS-I/checklist-map.js';

/**
 * Domain judgement selector with risk of bias level and optional direction
 * @param {Object} props
 * @param {string} props.domainId - Unique domain identifier
 * @param {string} props.judgement - Current judgement value
 * @param {string} [props.direction] - Current direction value (if applicable)
 * @param {Function} props.onJudgementChange - Callback when judgement changes
 * @param {Function} [props.onDirectionChange] - Callback when direction changes
 * @param {boolean} [props.showDirection] - Whether to show direction selector
 * @param {boolean} [props.isDomain1] - Whether this is Domain 1 (uses limited direction options)
 * @param {boolean} [props.disabled] - Whether the selector is disabled
 */
export function DomainJudgement(props) {
  const directionOptions = () => (props.isDomain1 ? DOMAIN1_DIRECTIONS : BIAS_DIRECTIONS);

  const getJudgementColor = judgement => {
    switch (judgement) {
      case 'Low':
        return 'bg-green-100 border-green-400 text-green-800';
      case 'Low (except for concerns about uncontrolled confounding)':
        return 'bg-green-100 border-green-400 text-green-800';
      case 'Moderate':
        return 'bg-yellow-100 border-yellow-400 text-yellow-800';
      case 'Serious':
        return 'bg-orange-100 border-orange-400 text-orange-800';
      case 'Critical':
        return 'bg-red-100 border-red-400 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-600';
    }
  };

  return (
    <div class='bg-gray-50 rounded-lg p-4 mt-4'>
      {/* Risk of bias judgement */}
      <div class='mb-3'>
        <div class='text-sm font-medium text-gray-700 mb-2'>Risk of bias judgement</div>
        <div class='flex flex-wrap gap-2'>
          <For each={ROB_JUDGEMENTS}>
            {judgement => {
              const isSelected = () => props.judgement === judgement;
              return (
                <button
                  type='button'
                  onClick={() => {
                    if (props.disabled) return;
                    // Toggle: deselect if already selected, otherwise select
                    props.onJudgementChange(isSelected() ? null : judgement);
                  }}
                  disabled={props.disabled}
                  class={`
                    inline-flex items-center justify-center px-3 py-1.5 rounded-md text-sm font-medium
                    transition-colors border-2
                    ${props.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    ${
                      isSelected() ?
                        getJudgementColor(judgement)
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }
                  `}
                >
                  {judgement}
                </button>
              );
            }}
          </For>
        </div>
      </div>

      {/* Direction of bias (optional) */}
      {props.showDirection && (
        <div>
          <div class='text-sm font-medium text-gray-700 mb-2'>
            Predicted direction of bias
            <span class='text-gray-400 font-normal ml-1'>(optional)</span>
          </div>
          <div class='flex flex-wrap gap-2'>
            <For each={directionOptions()}>
              {direction => {
                const isSelected = () => props.direction === direction;
                return (
                  <button
                    type='button'
                    onClick={() => {
                      if (props.disabled) return;
                      // Toggle: deselect if already selected, otherwise select
                      props.onDirectionChange?.(isSelected() ? null : direction);
                    }}
                    disabled={props.disabled}
                    class={`
                      inline-flex items-center justify-center px-2 py-1 rounded text-xs font-medium
                      transition-colors border
                      ${props.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      ${
                        isSelected() ?
                          'bg-blue-100 border-blue-400 text-blue-800'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }
                    `}
                  >
                    {direction}
                  </button>
                );
              }}
            </For>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact judgement badge for display purposes
 */
export function JudgementBadge(props) {
  const getColor = () => {
    switch (props.judgement) {
      case 'Low':
        return 'bg-green-100 text-green-800';
      case 'Low (except for concerns about uncontrolled confounding)':
      case 'Low (except confounding)':
        return 'bg-green-100 text-green-800';
      case 'Moderate':
        return 'bg-yellow-100 text-yellow-800';
      case 'Serious':
        return 'bg-orange-100 text-orange-800';
      case 'Critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <span class={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getColor()}`}>
      {props.judgement || 'Not assessed'}
    </span>
  );
}

export default DomainJudgement;
