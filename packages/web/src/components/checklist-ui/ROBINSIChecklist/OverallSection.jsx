import { For, Show } from 'solid-js';
import { OVERALL_ROB_JUDGEMENTS, BIAS_DIRECTIONS } from '@/ROBINS-I/checklist-map.js';
import { scoreChecklist } from '@/ROBINS-I/checklist.js';

/**
 * Overall risk of bias section with final judgement
 * @param {Object} props
 * @param {Object} props.overallState - Current overall state { judgement, direction }
 * @param {Object} props.checklistState - Full checklist state (for auto-scoring)
 * @param {Function} props.onUpdate - Callback when overall state changes
 * @param {boolean} [props.disabled] - Whether the section is disabled
 */
export function OverallSection(props) {
  // Calculated score based on domains
  const calculatedScore = () => scoreChecklist(props.checklistState);

  function handleJudgementChange(judgement) {
    props.onUpdate({
      ...props.overallState,
      judgement,
    });
  }

  function handleDirectionChange(direction) {
    props.onUpdate({
      ...props.overallState,
      direction,
    });
  }

  const getJudgementColor = judgement => {
    switch (judgement) {
      case 'Low (except confounding)':
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

  const getScoreColor = score => {
    switch (score) {
      case 'Low':
        return 'text-green-600';
      case 'Moderate':
        return 'text-yellow-600';
      case 'Serious':
        return 'text-orange-600';
      case 'Critical':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div class='bg-white rounded-lg shadow-md overflow-hidden'>
      <div class='px-6 py-4 bg-gray-800 text-white'>
        <h3 class='font-semibold text-lg'>Overall Risk of Bias</h3>
        <p class='text-sm text-gray-300 mt-1'>Final assessment based on all domain judgements</p>
      </div>

      <div class='px-6 py-5'>
        {/* Calculated score hint */}
        <div class='mb-4 p-3 bg-gray-50 rounded-lg'>
          <div class='text-sm text-gray-600'>
            <span class='font-medium'>Calculated score: </span>
            <span class={`font-semibold ${getScoreColor(calculatedScore())}`}>
              {calculatedScore()}
            </span>
          </div>
          <p class='text-xs text-gray-400 mt-1'>
            Based on the highest risk of bias across all domains. You may override this judgement
            below.
          </p>
        </div>

        {/* Overall risk of bias judgement */}
        <div class='mb-5'>
          <div class='text-sm font-medium text-gray-700 mb-3'>Overall risk of bias judgement</div>
          <div class='flex flex-wrap gap-2'>
            <For each={OVERALL_ROB_JUDGEMENTS}>
              {judgement => (
                <label
                  class={`
                    inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium
                    cursor-pointer transition-colors border-2
                    ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    ${
                      props.overallState?.judgement === judgement ?
                        getJudgementColor(judgement)
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }
                  `}
                >
                  <input
                    type='radio'
                    name='overall-judgement'
                    value={judgement}
                    checked={props.overallState?.judgement === judgement}
                    onChange={() => handleJudgementChange(judgement)}
                    disabled={props.disabled}
                    class='sr-only'
                  />
                  {judgement}
                </label>
              )}
            </For>
          </div>
        </div>

        {/* Direction of bias */}
        <div>
          <div class='text-sm font-medium text-gray-700 mb-3'>
            Predicted direction of bias
            <span class='text-gray-400 font-normal ml-1'>(optional)</span>
          </div>
          <div class='flex flex-wrap gap-2'>
            <For each={BIAS_DIRECTIONS}>
              {direction => (
                <label
                  class={`
                    inline-flex items-center justify-center px-3 py-1.5 rounded text-sm font-medium
                    cursor-pointer transition-colors border
                    ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    ${
                      props.overallState?.direction === direction ?
                        'bg-blue-100 border-blue-400 text-blue-800'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                    }
                  `}
                >
                  <input
                    type='radio'
                    name='overall-direction'
                    value={direction}
                    checked={props.overallState?.direction === direction}
                    onChange={() => handleDirectionChange(direction)}
                    disabled={props.disabled}
                    class='sr-only'
                  />
                  {direction}
                </label>
              )}
            </For>
            {/* Clear button */}
            <Show when={props.overallState?.direction}>
              <button
                type='button'
                onClick={() => handleDirectionChange(null)}
                disabled={props.disabled}
                class='px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600'
              >
                Clear
              </button>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OverallSection;
