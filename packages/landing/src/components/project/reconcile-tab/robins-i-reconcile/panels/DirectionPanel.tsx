import { useId } from 'react';
import { BIAS_DIRECTIONS } from '@/components/checklist/ROBINSIChecklist/checklist-map';

/**
 * Get button style for direction options
 */
function getDirectionButtonStyle(isSelected: boolean): string {
  if (!isSelected) {
    return 'border-border bg-card text-secondary-foreground hover:bg-muted';
  }
  return 'border-blue-400 bg-blue-50 text-blue-800';
}

interface DirectionPanelProps {
  title: string;
  panelType: 'reviewer1' | 'reviewer2' | 'final';
  direction?: string | null;
  directionOptions?: readonly string[];
  readOnly?: boolean;
  hideUseThis?: boolean;
  isSelected?: boolean;
  onDirectionChange?: (_direction: string) => void;
  onUseThis?: () => void;
}

export function DirectionPanel({
  title,
  panelType,
  direction,
  directionOptions,
  readOnly = false,
  hideUseThis = false,
  isSelected = false,
  onDirectionChange,
  onUseThis,
}: DirectionPanelProps) {
  const isFinal = panelType === 'final';
  const options = directionOptions || BIAS_DIRECTIONS;
  const radioGroupName = useId();

  return (
    <div className="p-4">
      {/* Panel Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-foreground font-semibold">{title}</h3>
        {!isFinal && !hideUseThis && (
          <button
            onClick={() => onUseThis?.()}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              isSelected ? 'bg-blue-600 text-white' : (
                'bg-secondary text-secondary-foreground hover:bg-blue-100 hover:text-blue-700'
              )
            }`}
          >
            {isSelected ? 'Selected' : 'Use This'}
          </button>
        )}
      </div>

      {/* Direction Badge (for reviewer panels) */}
      {!isFinal && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Direction:</span>
          <span className="border-border bg-secondary text-secondary-foreground inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium">
            {direction || 'Not set'}
          </span>
        </div>
      )}

      {/* Direction Options */}
      <div className="space-y-2">
        <label className="text-secondary-foreground mb-1 block text-xs font-medium">
          Predicted Direction of Bias
        </label>
        {options.map(option => {
          const optionSelected = direction === option;
          const baseClasses =
            'w-full rounded-lg border-2 px-3 py-2 text-left text-sm font-medium transition-all';

          return readOnly ? (
            <div key={option} className={`${baseClasses} ${getDirectionButtonStyle(optionSelected)}`}>
              {option}
            </div>
          ) : (
            <label
              key={option}
              className={`${baseClasses} block cursor-pointer hover:border-blue-300 ${getDirectionButtonStyle(optionSelected)}`}
            >
              <input
                type="radio"
                name={radioGroupName}
                value={option}
                checked={optionSelected}
                onChange={() => onDirectionChange?.(option)}
                className="hidden"
              />
              {option}
            </label>
          );
        })}
      </div>
    </div>
  );
}
