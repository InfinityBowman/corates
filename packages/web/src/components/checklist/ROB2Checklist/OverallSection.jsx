import { For, Show, createMemo } from 'solid-js';
import { BIAS_DIRECTIONS } from './checklist-map.js';
import { getSmartScoring, mapOverallJudgementToDisplay } from './checklist.js';

/**
 * Overall risk of bias section with final judgement
 * Uses auto-scoring: calculated judgement from all domains
 *
 * @param {Object} props
 * @param {Object} props.overallState - Current overall state { judgement, direction }
 * @param {Object} props.checklistState - Full checklist state (for auto-scoring)
 * @param {Function} props.onUpdate - Callback when overall state changes
 * @param {boolean} [props.disabled] - Whether the section is disabled
 */
export function OverallSection(props) {
  // Smart scoring: compute auto judgement from all domains
  const smartScoring = createMemo(() => getSmartScoring(props.checklistState));

  // Calculated overall score
  const calculatedScore = () => smartScoring().overall;

  // Calculated overall in display format
  const calculatedDisplayJudgement = createMemo(() => {
    const score = calculatedScore();
    return mapOverallJudgementToDisplay(score);
  });

  // Effective judgement: use calculated value
  const effectiveJudgement = createMemo(() => {
    return calculatedDisplayJudgement();
  });

  function handleDirectionChange(direction) {
    props.onUpdate({
      ...props.overallState,
      direction,
    });
  }

  const getJudgementColor = (judgement, isSelected) => {
    if (!isSelected) {
      return 'border-gray-200 bg-gray-50 text-gray-400';
    }

    switch (judgement) {
      case 'Low':
      case 'Low risk of bias':
        return 'bg-green-100 border-green-400 text-green-800';
      case 'Some concerns':
        return 'bg-yellow-100 border-yellow-400 text-yellow-800';
      case 'High':
      case 'High risk of bias':
        return 'bg-red-100 border-red-400 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-600';
    }
  };

  const getScoreBadgeColor = score => {
    switch (score) {
      case 'Low':
        return 'bg-green-100 text-green-800';
      case 'Some concerns':
        return 'bg-yellow-100 text-yellow-800';
      case 'High':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const judgementOptions = ['Low risk of bias', 'Some concerns', 'High risk of bias'];

  return (
    <div class='overflow-hidden rounded-lg bg-white shadow-md'>
      <div class='bg-gray-800 px-6 py-4 text-white'>
        <div class='flex items-center justify-between'>
          <div>
            <h3 class='text-lg font-semibold'>Overall Risk of Bias</h3>
            <p class='mt-1 text-sm text-gray-300'>
              Final assessment based on all domain judgements
            </p>
          </div>

          {/* Overall calculated badge in header */}
          <Show when={calculatedScore() && calculatedScore() !== 'Incomplete'}>
            <span
              class={`rounded-md px-3 py-1 text-sm font-semibold ${getScoreBadgeColor(calculatedScore())}`}
            >
              {calculatedScore()}
            </span>
          </Show>
          <Show when={calculatedScore() === null || smartScoring().isComplete === false}>
            <span class='rounded-md bg-gray-600 px-3 py-1 text-sm text-gray-300'>Incomplete</span>
          </Show>
        </div>
      </div>

      <div class='px-6 py-5'>
        {/* Calculated score display */}
        <div class='mb-5 rounded-lg bg-gray-50 p-4'>
          <div class='flex items-center gap-3'>
            <span class='text-sm font-medium text-gray-700'>Calculated judgement:</span>
            <Show
              when={effectiveJudgement()}
              fallback={<span class='text-sm text-gray-400'>Complete all domains</span>}
            >
              <span
                class={`rounded-md px-2.5 py-1 text-sm font-medium ${getScoreBadgeColor(calculatedScore())}`}
              >
                {effectiveJudgement()}
              </span>
            </Show>
          </div>
        </div>

        {/* Overall risk of bias judgement display (read-only) */}
        <div class='mb-5'>
          <div class='mb-3 text-sm font-medium text-gray-700'>Overall risk of bias judgement</div>
          <div class='flex flex-wrap gap-2'>
            <For each={judgementOptions}>
              {judgement => {
                const isSelected = () => effectiveJudgement() === judgement;
                return (
                  <div
                    class={`inline-flex cursor-not-allowed items-center justify-center rounded-lg border-2 px-4 py-2 text-sm font-medium opacity-75 ${getJudgementColor(judgement, isSelected())}`}
                  >
                    {judgement}
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        {/* Direction of bias */}
        <div>
          <div class='mb-3 text-sm font-medium text-gray-700'>
            Predicted direction of bias
            <span class='ml-1 font-normal text-gray-400'>(optional)</span>
          </div>
          <div class='flex flex-wrap gap-2'>
            <For each={BIAS_DIRECTIONS}>
              {direction => {
                const isSelected = () => props.overallState?.direction === direction;
                return (
                  <button
                    type='button'
                    onClick={() => {
                      if (props.disabled) return;
                      handleDirectionChange(isSelected() ? null : direction);
                    }}
                    disabled={props.disabled}
                    class={`inline-flex items-center justify-center rounded border px-3 py-1.5 text-sm font-medium transition-colors ${props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${
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
      </div>
    </div>
  );
}

export default OverallSection;
