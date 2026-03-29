import { useId } from 'react';
import { ROB_JUDGEMENTS } from '@/components/checklist/ROBINSIChecklist/checklist-map';

/**
 * Get badge color for risk of bias judgement
 */
function getJudgementBadgeStyle(judgement: string | null | undefined): string {
  if (!judgement) return 'bg-secondary text-muted-foreground border-border';

  if (judgement.toLowerCase().includes('low')) {
    return 'bg-green-100 text-green-800 border-green-200';
  }
  if (judgement.toLowerCase().includes('moderate')) {
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }
  if (judgement.toLowerCase().includes('serious')) {
    return 'bg-orange-100 text-orange-800 border-orange-200';
  }
  if (judgement.toLowerCase().includes('critical')) {
    return 'bg-red-100 text-red-800 border-red-200';
  }
  return 'bg-secondary text-muted-foreground border-border';
}

/**
 * Get button style for judgement options
 */
function getJudgementButtonStyle(isSelected: boolean): string {
  if (!isSelected) {
    return 'border-border bg-card text-secondary-foreground hover:bg-muted';
  }
  return 'border-blue-400 bg-blue-50 text-blue-800';
}

interface JudgementPanelProps {
  title: string;
  panelType: 'reviewer1' | 'reviewer2' | 'final';
  judgement?: string | null;
  judgementOptions?: readonly string[];
  readOnly?: boolean;
  hideUseThis?: boolean;
  isSelected?: boolean;
  onJudgementChange?: (_judgement: string) => void;
  onUseThis?: () => void;
}

export function JudgementPanel({
  title,
  panelType,
  judgement,
  judgementOptions,
  readOnly = false,
  hideUseThis = false,
  isSelected = false,
  onJudgementChange,
  onUseThis,
}: JudgementPanelProps) {
  const isFinal = panelType === 'final';
  const options = judgementOptions || ROB_JUDGEMENTS;
  const radioGroupName = useId();

  return (
    <div className='p-4'>
      {/* Panel Header */}
      <div className='mb-4 flex items-center justify-between'>
        <h3 className='text-foreground font-semibold'>{title}</h3>
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

      {/* Judgement Badge (for reviewer panels) */}
      {!isFinal && (
        <div className='mb-4 flex flex-wrap items-center gap-2'>
          <span className='text-muted-foreground text-xs'>Judgement:</span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getJudgementBadgeStyle(judgement)}`}
          >
            {judgement || 'Not set'}
          </span>
        </div>
      )}

      {/* Judgement Options */}
      <div className='flex flex-col gap-2'>
        <label className='text-secondary-foreground mb-1 block text-xs font-medium'>
          Risk of Bias Judgement
        </label>
        {options.map(option => {
          const optionSelected = judgement === option;
          const baseClasses =
            'w-full rounded-lg border-2 px-3 py-2 text-left text-sm font-medium transition-all';

          return readOnly ?
              <div
                key={option}
                className={`${baseClasses} ${getJudgementButtonStyle(optionSelected)}`}
              >
                {option}
              </div>
            : <label
                key={option}
                className={`${baseClasses} block cursor-pointer hover:border-blue-300 ${getJudgementButtonStyle(optionSelected)}`}
              >
                <input
                  type='radio'
                  name={radioGroupName}
                  value={option}
                  checked={optionSelected}
                  onChange={() => onJudgementChange?.(option)}
                  className='hidden'
                />
                {option}
              </label>;
        })}
      </div>
    </div>
  );
}
