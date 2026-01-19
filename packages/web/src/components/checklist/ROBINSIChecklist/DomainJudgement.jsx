import { For, Show } from 'solid-js';
import { ROB_JUDGEMENTS, BIAS_DIRECTIONS, DOMAIN1_DIRECTIONS } from './checklist-map.js';

/**
 * Domain judgement selector with risk of bias level and optional direction
 * Supports auto-first mode: in auto mode, buttons are visually secondary and clicking switches to manual
 *
 * @param {Object} props
 * @param {string} props.domainId - Unique domain identifier
 * @param {string} props.judgement - Current judgement value
 * @param {string} [props.direction] - Current direction value (if applicable)
 * @param {Function} props.onJudgementChange - Callback when judgement changes
 * @param {Function} [props.onDirectionChange] - Callback when direction changes
 * @param {boolean} [props.showDirection] - Whether to show direction selector
 * @param {boolean} [props.isDomain1] - Whether this is Domain 1 (uses limited direction options)
 * @param {boolean} [props.disabled] - Whether the selector is disabled
 * @param {boolean} [props.isAutoMode] - Whether in auto mode (buttons are secondary, clicking switches to manual)
 */
export function DomainJudgement(props) {
  const directionOptions = () => (props.isDomain1 ? DOMAIN1_DIRECTIONS : BIAS_DIRECTIONS);

  const getJudgementColor = (judgement, isSelected) => {
    if (!isSelected) {
      // Unselected state - slightly dimmed in auto mode
      return props.isAutoMode ?
          'border-border bg-muted text-muted-foreground hover:border-border hover:bg-card'
        : 'border-border bg-card text-muted-foreground hover:border-border';
    }

    // Selected state
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
        return 'bg-muted border-border text-muted-foreground';
    }
  };

  // Shorten long judgement labels for display
  const getShortLabel = judgement => {
    if (judgement === 'Low (except for concerns about uncontrolled confounding)') {
      return 'Low (except confounding)';
    }
    return judgement;
  };

  return (
    <div>
      {/* Risk of bias judgement buttons */}
      <div class='flex flex-wrap gap-2'>
        <For each={ROB_JUDGEMENTS}>
          {judgement => {
            const isSelected = () => props.judgement === judgement;
            return (
              <button
                type='button'
                onClick={() => {
                  if (props.disabled) return;
                  // In both modes: select the judgement (switches to manual via parent)
                  props.onJudgementChange(isSelected() ? null : judgement);
                }}
                disabled={props.disabled}
                class={`inline-flex items-center justify-center rounded-md border-2 px-3 py-1.5 text-sm font-medium transition-colors ${props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${getJudgementColor(judgement, isSelected())}`}
              >
                {getShortLabel(judgement)}
              </button>
            );
          }}
        </For>
      </div>

      {/* Direction of bias (optional) */}
      <Show when={props.showDirection}>
        <div class='mt-3'>
          <div class='text-secondary-foreground mb-2 text-sm font-medium'>
            Predicted direction of bias
            <span class='text-muted-foreground/70 ml-1 font-normal'>(optional)</span>
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
                      props.onDirectionChange?.(isSelected() ? null : direction);
                    }}
                    disabled={props.disabled}
                    class={`inline-flex items-center justify-center rounded border px-2 py-1 text-xs font-medium transition-colors ${props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${
                      isSelected() ?
                        'border-blue-400 bg-blue-100 text-blue-800'
                      : 'border-border bg-card text-muted-foreground hover:border-border'
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
        return 'bg-secondary text-muted-foreground';
    }
  };

  // Shorten long judgement labels for badges
  const getShortLabel = () => {
    if (props.judgement === 'Low (except for concerns about uncontrolled confounding)') {
      return 'Low (except confounding)';
    }
    return props.judgement || 'Not assessed';
  };

  return (
    <span class={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${getColor()}`}>
      {getShortLabel()}
    </span>
  );
}

export default DomainJudgement;
