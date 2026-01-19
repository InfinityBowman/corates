import { For, Show, createMemo } from 'solid-js';
import { OVERALL_ROB_JUDGEMENTS, BIAS_DIRECTIONS } from './checklist-map.js';
import { getSmartScoring, mapOverallJudgementToDisplay } from './checklist.js';

/**
 * Overall risk of bias section with final judgement
 * Now with auto-first scoring: calculated judgement is primary, manual override is explicit
 *
 * @param {Object} props
 * @param {Object} props.overallState - Current overall state { judgement, judgementSource, direction }
 * @param {Object} props.checklistState - Full checklist state (for auto-scoring)
 * @param {Function} props.onUpdate - Callback when overall state changes
 * @param {boolean} [props.disabled] - Whether the section is disabled
 */
export function OverallSection(props) {
  // Smart scoring: compute auto judgement from all domains
  const smartScoring = createMemo(() => getSmartScoring(props.checklistState));

  // Calculated overall score (internal format)
  const calculatedScore = () => smartScoring().overall;

  // Calculated overall in display format (maps to OVERALL_ROB_JUDGEMENTS)
  const calculatedDisplayJudgement = createMemo(() => {
    const score = calculatedScore();
    return mapOverallJudgementToDisplay(score);
  });

  // Check if currently in manual mode (reactive)
  const isManualMode = createMemo(() => props.overallState?.judgementSource === 'manual');

  // Effective judgement: what's actually shown/used
  const effectiveJudgement = createMemo(() => {
    if (isManualMode() && props.overallState?.judgement) {
      return props.overallState.judgement;
    }
    return calculatedDisplayJudgement();
  });

  function handleJudgementChange(judgement) {
    // Clicking a judgement button switches to manual mode
    props.onUpdate({
      ...props.overallState,
      judgement,
      judgementSource: 'manual',
    });
  }

  function handleDirectionChange(direction) {
    props.onUpdate({
      ...props.overallState,
      direction,
    });
  }

  function handleRevertToAuto() {
    // Reset to auto mode with calculated judgement
    const currentState = props.overallState || {};
    props.onUpdate({
      ...currentState,
      judgement: calculatedDisplayJudgement(),
      judgementSource: 'auto',
    });
  }

  function handleSwitchToManual() {
    // Switch to manual mode but keep current judgement (or use current auto if no judgement set)
    const currentState = props.overallState || {};
    props.onUpdate({
      ...currentState,
      judgement: currentState.judgement || calculatedDisplayJudgement(),
      judgementSource: 'manual',
    });
  }

  const getJudgementColor = (judgement, isSelected) => {
    if (!isSelected) {
      return isManualMode() ?
          'border-border bg-card text-muted-foreground hover:border-border'
        : 'border-border bg-muted text-muted-foreground hover:border-border hover:bg-card';
    }

    switch (judgement) {
      case 'Low risk of bias except for concerns about uncontrolled confounding':
        return 'bg-green-100 border-green-400 text-green-800';
      case 'Moderate risk':
        return 'bg-yellow-100 border-yellow-400 text-yellow-800';
      case 'Serious risk':
        return 'bg-orange-100 border-orange-400 text-orange-800';
      case 'Critical risk':
        return 'bg-red-100 border-red-400 text-red-800';
      default:
        return 'bg-muted border-border text-muted-foreground';
    }
  };

  const getScoreBadgeColor = score => {
    switch (score) {
      case 'Low':
      case 'Low (except for concerns about uncontrolled confounding)':
        return 'bg-green-100 text-green-800';
      case 'Moderate':
        return 'bg-yellow-100 text-yellow-800';
      case 'Serious':
        return 'bg-orange-100 text-orange-800';
      case 'Critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-secondary text-muted-foreground';
    }
  };

  return (
    <div class='bg-card overflow-hidden rounded-lg shadow-md'>
      <div class='bg-foreground text-background px-6 py-4'>
        <div class='flex items-center justify-between'>
          <div>
            <h3 class='text-lg font-semibold'>Overall Risk of Bias</h3>
            <p class='text-muted mt-1 text-sm'>Final assessment based on all domain judgements</p>
          </div>

          {/* Overall calculated badge in header */}
          <Show when={calculatedScore() && calculatedScore() !== 'Incomplete'}>
            <div class='flex flex-col items-end gap-1'>
              <span
                class={`rounded-md px-3 py-1 text-sm font-semibold ${getScoreBadgeColor(calculatedScore())}`}
              >
                {calculatedScore()}
              </span>
              <Show when={isManualMode()}>
                <span class='text-xs text-amber-300'>Manual override</span>
              </Show>
            </div>
          </Show>
          <Show when={calculatedScore() === 'Incomplete'}>
            <span class='bg-muted-foreground/50 text-muted rounded-md px-3 py-1 text-sm'>
              Incomplete
            </span>
          </Show>
        </div>
      </div>

      <div class='px-6 py-5'>
        {/* Calculated score display with mode toggle */}
        <div class='bg-muted mb-5 flex items-center justify-between rounded-lg p-4'>
          <div class='flex items-center gap-3'>
            <span class='text-secondary-foreground text-sm font-medium'>Calculated judgement:</span>
            <Show
              when={calculatedDisplayJudgement()}
              fallback={<span class='text-muted-foreground/70 text-sm'>Complete all domains</span>}
            >
              <span
                class={`rounded-md px-2.5 py-1 text-sm font-medium ${getScoreBadgeColor(calculatedScore())}`}
              >
                {calculatedDisplayJudgement()}
              </span>
            </Show>
          </div>

          {/* Mode toggle */}
          <div class='flex items-center gap-2'>
            <div class='border-border bg-card flex rounded-md border text-xs'>
              <button
                type='button'
                onClick={handleRevertToAuto}
                disabled={props.disabled}
                class={`rounded-l-md px-2.5 py-1 transition-colors ${
                  !isManualMode() ?
                    'bg-blue-100 text-blue-800'
                  : 'text-muted-foreground hover:bg-muted'
                } ${props.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                Auto
              </button>
              <button
                type='button'
                onClick={handleSwitchToManual}
                disabled={props.disabled}
                class={`border-border rounded-r-md border-l px-2.5 py-1 transition-colors ${
                  isManualMode() ?
                    'bg-amber-100 text-amber-800'
                  : 'text-muted-foreground hover:bg-muted'
                } ${props.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                Manual
              </button>
            </div>
          </div>
        </div>

        {/* Overall risk of bias judgement buttons */}
        <div class='mb-5'>
          <div class='text-secondary-foreground mb-3 text-sm font-medium'>
            Overall risk of bias judgement
          </div>
          <div class='flex flex-wrap gap-2'>
            <For each={OVERALL_ROB_JUDGEMENTS}>
              {judgement => {
                const isSelected = () => effectiveJudgement() === judgement;
                return (
                  <button
                    type='button'
                    onClick={() => {
                      if (props.disabled) return;
                      handleJudgementChange(isSelected() ? null : judgement);
                    }}
                    disabled={props.disabled}
                    class={`inline-flex items-center justify-center rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${getJudgementColor(judgement, isSelected())}`}
                  >
                    {judgement}
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        {/* Direction of bias */}
        <div>
          <div class='text-secondary-foreground mb-3 text-sm font-medium'>
            Predicted direction of bias
            <span class='text-muted-foreground/70 ml-1 font-normal'>(optional)</span>
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
                      : 'text-muted-foreground border-border bg-muted hover:border-border'
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
