/**
 * DomainJudgement - ROBINS-I domain judgement selector
 * Supports auto-first mode: in auto mode buttons are secondary, clicking switches to manual.
 * Uses ROBINS-I specific judgement levels (Low, Moderate, Serious, Critical).
 */

import { useMemo } from 'react';
import { ROB_JUDGEMENTS, BIAS_DIRECTIONS, DOMAIN1_DIRECTIONS } from './checklist-map';

interface DomainJudgementProps {
  domainId: string;
  judgement: string | null;
  direction?: string | null;
  onJudgementChange: (_value: string | null) => void;
  onDirectionChange?: (_value: string | null) => void;
  showDirection?: boolean;
  isDomain1?: boolean;
  disabled?: boolean;
  isAutoMode?: boolean;
}

export function DomainJudgement({
  judgement,
  direction,
  onJudgementChange,
  onDirectionChange,
  showDirection,
  isDomain1,
  disabled,
  isAutoMode,
}: DomainJudgementProps) {
  const directionOptions = useMemo(
    () => isDomain1 ? DOMAIN1_DIRECTIONS : BIAS_DIRECTIONS,
    [isDomain1],
  );

  const getJudgementColor = (j: string, isSelected: boolean) => {
    if (!isSelected) {
      return isAutoMode
        ? 'border-border bg-muted text-muted-foreground hover:border-border hover:bg-card'
        : 'border-border bg-card text-muted-foreground hover:border-border';
    }
    switch (j) {
      case 'Low':
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

  const getShortLabel = (j: string) => {
    if (j === 'Low (except for concerns about uncontrolled confounding)') {
      return 'Low (except confounding)';
    }
    return j;
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {ROB_JUDGEMENTS.map(j => {
          const isSelected = judgement === j;
          return (
            <button
              key={j}
              type="button"
              onClick={() => {
                if (disabled) return;
                onJudgementChange(isSelected ? null : j);
              }}
              disabled={disabled}
              className={`inline-flex items-center justify-center rounded-md border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              } ${getJudgementColor(j, isSelected)}`}
            >
              {getShortLabel(j)}
            </button>
          );
        })}
      </div>

      {showDirection && (
        <div className="mt-3">
          <div className="text-secondary-foreground mb-2 text-sm font-medium">
            Predicted direction of bias
            <span className="text-muted-foreground/70 ml-1 font-normal">(optional)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {directionOptions.map(d => {
              const isSelected = direction === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    onDirectionChange?.(isSelected ? null : d);
                  }}
                  disabled={disabled}
                  className={`inline-flex items-center justify-center rounded border px-2 py-1 text-xs font-medium transition-colors ${
                    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'border-blue-400 bg-blue-100 text-blue-800'
                      : 'border-border bg-card text-muted-foreground hover:border-border'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact judgement badge for ROBINS-I
 */
export function JudgementBadge({ judgement }: { judgement: string }) {
  const getColor = () => {
    switch (judgement) {
      case 'Low':
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

  const getShortLabel = () => {
    if (judgement === 'Low (except for concerns about uncontrolled confounding)') {
      return 'Low (except confounding)';
    }
    return judgement || 'Not assessed';
  };

  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${getColor()}`}>
      {getShortLabel()}
    </span>
  );
}
