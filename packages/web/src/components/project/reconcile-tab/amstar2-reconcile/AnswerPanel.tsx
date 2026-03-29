/**
 * AnswerPanel - Panel showing one version of answers (reviewer or final)
 * Supports both full and compact display modes for regular and multi-part questions.
 */

import { useId } from 'react';
import { AMSTAR_CHECKLIST } from '@/components/checklist/AMSTAR2Checklist/checklist-map.js';

function getAnswerBadgeStyle(answer: string | null) {
  switch (answer) {
    case 'Yes':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'Partial Yes':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'No':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-secondary text-muted-foreground border-border';
  }
}

interface AnswerPanelProps {
  questionKey: string;
  columns?: any[];
  answers: any;
  compact?: boolean;
  isFinal?: boolean;
  onCheckboxChange?: (_colIdx: number, _optIdx: number) => void;
  onRadioChange?: (_colIdx: number, _optIdx: number) => void;
  selectedSource?: string | null;
  hideSelectButtons?: boolean;
  readOnly: boolean;
  panelId?: string;
  title: string;
  finalAnswer?: string | null;
  isSelected?: boolean;
  onUseThis?: () => void;
  highlightColor?: string;
}

export function AnswerPanel({
  questionKey,
  columns: columnsProp,
  answers: answersProp,
  compact,
  isFinal,
  onCheckboxChange,
  onRadioChange,
  selectedSource,
  hideSelectButtons,
  readOnly,
  panelId,
  title,
  finalAnswer,
  isSelected,
  onUseThis,
}: AnswerPanelProps) {
  const uniqueId = useId();
  const question = (AMSTAR_CHECKLIST as any)[questionKey];
  const columns = columnsProp || question?.columns || [];
  const answersArray = answersProp?.answers || [];

  if (compact) {
    return (
      <div className='flex flex-col gap-3'>
        {columns.map((col: any, colIdx: number) => {
          const isLastColumn = colIdx === columns.length - 1;
          const colAnswers = answersArray[colIdx] || [];

          return (
            <div key={colIdx} className='border-border border-t pt-2 first:border-t-0 first:pt-0'>
              {col.label && (
                <div className='text-secondary-foreground mb-1 text-xs font-semibold'>
                  {col.label}
                </div>
              )}
              <div className='flex flex-col gap-1'>
                {col.options.map((option: string, optIdx: number) => {
                  const isChecked = colAnswers[optIdx] === true;
                  return (
                    <label
                      key={optIdx}
                      className={`flex items-start gap-2 text-xs ${readOnly ? '' : 'hover:bg-muted -m-1 cursor-pointer rounded p-1'}`}
                    >
                      {isLastColumn ?
                        <input
                          type='radio'
                          name={`${panelId || title || 'panel'}-${questionKey}-compact-${colIdx}-${uniqueId}`}
                          checked={isChecked}
                          disabled={readOnly}
                          onChange={() => !readOnly && onRadioChange?.(colIdx, optIdx)}
                          className='border-border focus:ring-primary mt-0.5 size-3 shrink-0 text-blue-600'
                        />
                      : <input
                          type='checkbox'
                          checked={isChecked}
                          disabled={readOnly}
                          onChange={() => !readOnly && onCheckboxChange?.(colIdx, optIdx)}
                          className='border-border focus:ring-primary mt-0.5 size-3 shrink-0 rounded text-blue-600'
                        />
                      }
                      <span
                        className={`text-xs ${isChecked ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
                      >
                        {option}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Full (non-compact) mode
  return (
    <div className='p-4'>
      {/* Panel Header */}
      <div className={`${isFinal ? 'mb-0' : 'mb-4'} flex items-center justify-between`}>
        <div>
          <h3 className='text-foreground -mb-1 font-semibold'>{title}</h3>
          {isFinal && selectedSource && (
            <span className='text-muted-foreground text-xs'>
              {selectedSource === 'custom' ?
                'Custom selection'
              : `Based on ${selectedSource === 'reviewer1' ? 'Reviewer 1' : 'Reviewer 2'}`}
            </span>
          )}
        </div>
        {!isFinal && !hideSelectButtons && (
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

      {/* Final Answer Badge */}
      <div className='mb-4 flex flex-wrap items-center gap-2'>
        <span className='text-muted-foreground text-xs'>Result:</span>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getAnswerBadgeStyle(finalAnswer || null)}`}
        >
          {finalAnswer || 'Not selected'}
        </span>
      </div>

      {/* Answer Columns */}
      <div className='flex flex-col gap-4'>
        {columns.map((col: any, colIdx: number) => {
          const isLastColumn = colIdx === columns.length - 1;
          const colAnswers = answersArray[colIdx] || [];

          return (
            <div key={colIdx} className='border-border border-t pt-3'>
              {col.label && (
                <div className='text-secondary-foreground mb-2 text-xs font-semibold'>
                  {col.label}
                </div>
              )}
              {col.description && (
                <div className='text-muted-foreground mb-2 text-xs'>{col.description}</div>
              )}
              <div className='flex flex-col gap-2'>
                {col.options.map((option: string, optIdx: number) => {
                  const isChecked = colAnswers[optIdx] === true;
                  return (
                    <label
                      key={optIdx}
                      className={`flex items-start gap-2 text-xs ${readOnly ? '' : 'hover:bg-muted -m-1 cursor-pointer rounded p-1'}`}
                    >
                      {isLastColumn ?
                        <input
                          type='radio'
                          name={`${title}-${questionKey}-final-${uniqueId}`}
                          checked={isChecked}
                          disabled={readOnly}
                          onChange={() => !readOnly && onRadioChange?.(colIdx, optIdx)}
                          className='border-border focus:ring-primary mt-0.5 size-3.5 shrink-0 text-blue-600'
                        />
                      : <input
                          type='checkbox'
                          checked={isChecked}
                          disabled={readOnly}
                          onChange={() => !readOnly && onCheckboxChange?.(colIdx, optIdx)}
                          className='border-border focus:ring-primary mt-0.5 size-3.5 shrink-0 rounded text-blue-600'
                        />
                      }
                      <span
                        className={`${isChecked ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
                      >
                        {option}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
