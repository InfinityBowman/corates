/**
 * DomainJudgement - Judgement selector and badge for ROB2 domains
 */

import { JUDGEMENTS, BIAS_DIRECTIONS } from './checklist-map';

export function JudgementBadge({ judgement }: { judgement: string }) {
  const getColor = () => {
    switch (judgement) {
      case 'Low':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Some concerns':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'High':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-secondary text-muted-foreground border-border';
    }
  };

  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${getColor()}`}
    >
      {judgement}
    </span>
  );
}

interface DomainJudgementProps {
  domainId: string;
  judgement: string | null;
  direction: string | null;
  onJudgementChange: (_value: string | null) => void;
  onDirectionChange: (_value: string | null) => void;
  showDirection?: boolean;
  disabled?: boolean;
  isAutoMode?: boolean;
}

export function DomainJudgement({
  judgement,
  direction,
  onJudgementChange,
  onDirectionChange,
  showDirection,
  disabled,
  isAutoMode,
}: DomainJudgementProps) {
  const judgementOptions = Object.values(JUDGEMENTS) as string[];

  const getJudgementColor = (j: string, isSelected: boolean) => {
    if (!isSelected) {
      return isAutoMode ?
          'border-border bg-muted text-muted-foreground/70 cursor-not-allowed'
        : 'border-border bg-card text-muted-foreground hover:border-border cursor-pointer';
    }
    switch (j) {
      case 'Low':
        return 'bg-green-100 border-green-400 text-green-800';
      case 'Some concerns':
        return 'bg-yellow-100 border-yellow-400 text-yellow-800';
      case 'High':
        return 'bg-red-100 border-red-400 text-red-800';
      default:
        return 'bg-muted border-border text-muted-foreground';
    }
  };

  return (
    <div className='flex flex-col gap-4'>
      <div>
        <div className='text-muted-foreground mb-2 text-xs font-medium'>
          {isAutoMode ? 'Auto-calculated judgement' : 'Select judgement'}
        </div>
        <div className='flex flex-wrap gap-2'>
          {judgementOptions.map(j => {
            const isSelected = judgement === j;
            return (
              <button
                key={j}
                type='button'
                onClick={() => {
                  if (disabled || isAutoMode) return;
                  onJudgementChange(isSelected ? null : j);
                }}
                disabled={disabled || isAutoMode}
                className={`inline-flex items-center justify-center rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                  disabled ? 'cursor-not-allowed opacity-50' : ''
                } ${getJudgementColor(j, isSelected)}`}
              >
                {j}
              </button>
            );
          })}
        </div>
      </div>

      {showDirection && (
        <div>
          <div className='text-muted-foreground mb-2 text-xs font-medium'>
            Predicted direction of bias
            <span className='text-muted-foreground/70 ml-1 font-normal'>(optional)</span>
          </div>
          <div className='flex flex-wrap gap-1.5'>
            {BIAS_DIRECTIONS.map(d => {
              const isSelected = direction === d;
              return (
                <button
                  key={d}
                  type='button'
                  onClick={() => {
                    if (disabled) return;
                    onDirectionChange(isSelected ? null : d);
                  }}
                  disabled={disabled}
                  className={`inline-flex items-center justify-center rounded border px-2 py-1 text-xs font-medium transition-colors ${
                    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  } ${
                    isSelected ?
                      'border-blue-400 bg-blue-100 text-blue-800'
                    : 'border-border bg-muted text-muted-foreground hover:border-border'
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
