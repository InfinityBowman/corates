import { useId } from 'react';
import { BIAS_DIRECTIONS } from '@corates/shared/checklists/rob2';

/**
 * Get highlighted background color for selected direction
 */
function getSelectedStyle(): string {
  return 'border-blue-400 bg-blue-50 text-blue-800';
}

interface DirectionPanelProps {
  title: string;
  panelType: 'reviewer1' | 'reviewer2' | 'final';
  direction: string | null;
  readOnly: boolean;
  hideUseThis?: boolean;
  isSelected?: boolean;
  onDirectionChange?: (_direction: string) => void;
  onUseThis?: () => void;
}

/**
 * Panel for displaying/selecting bias direction
 */
export function DirectionPanel({
  title,
  panelType,
  direction,
  readOnly,
  hideUseThis,
  isSelected,
  onDirectionChange,
  onUseThis,
}: DirectionPanelProps) {
  const isFinal = panelType === 'final';
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
              isSelected
                ? 'bg-blue-600 text-white'
                : 'bg-secondary text-secondary-foreground hover:bg-blue-100 hover:text-blue-700'
            }`}
          >
            {isSelected ? 'Selected' : 'Use This'}
          </button>
        )}
      </div>

      {/* Direction Options */}
      <div className="flex flex-col gap-2">
        {[...BIAS_DIRECTIONS].map((option) => {
          const optionSelected = direction === option;
          const baseClasses =
            'flex items-center rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all';

          if (readOnly) {
            return (
              <div
                key={option}
                className={`${baseClasses} ${
                  optionSelected
                    ? getSelectedStyle()
                    : 'border-border bg-card text-secondary-foreground'
                }`}
              >
                <span>{option}</span>
              </div>
            );
          }

          return (
            <label
              key={option}
              className={`${baseClasses} cursor-pointer focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-1 focus-within:outline-none hover:border-blue-300 ${
                optionSelected
                  ? getSelectedStyle()
                  : 'border-border bg-card text-secondary-foreground hover:bg-blue-50'
              }`}
            >
              <input
                type="radio"
                name={radioGroupName}
                value={option}
                checked={optionSelected}
                onChange={() => onDirectionChange?.(option)}
                className="hidden"
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>

      {/* Selected Badge (for reviewer panels) */}
      {!isFinal && direction && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Selected:</span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getSelectedStyle()}`}
          >
            {direction}
          </span>
        </div>
      )}
    </div>
  );
}
