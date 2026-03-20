/**
 * SectionB - ROBINS-I: Decide whether to proceed with risk-of-bias assessment
 * If B2 or B3 is Yes/Probably Yes, the result is classified as Critical risk of bias.
 */

import { useMemo, useCallback, useId } from 'react';
import { AlertCircleIcon } from 'lucide-react';
import { SECTION_B, RESPONSE_LABELS } from './checklist-map';
import { shouldStopAssessment } from './checklist.js';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';

interface SectionBProps {
  sectionBState: any;
  onUpdate: (_newState: any) => void;
  disabled?: boolean;
  getRobinsText?: (_sectionKey: string, _fieldKey: string, _questionKey?: string) => any;
}

export function SectionB({ sectionBState, onUpdate, disabled, getRobinsText }: SectionBProps) {
  const uniqueId = useId();
  const stopAssessment = useMemo(() => shouldStopAssessment(sectionBState), [sectionBState]);

  const handleAnswerChange = useCallback(
    (questionKey: string, value: string) => {
      const newState = {
        ...sectionBState,
        [questionKey]: { ...sectionBState?.[questionKey], answer: value },
      };
      newState.stopAssessment = shouldStopAssessment(newState);
      onUpdate(newState);
    },
    [sectionBState, onUpdate],
  );

  const responseOptions = ['Y', 'PY', 'PN', 'N'];

  return (
    <div className='border-border bg-card overflow-hidden rounded-lg border shadow-sm'>
      <div className='border-border bg-muted border-b px-6 py-4'>
        <h3 className='text-foreground text-base font-semibold'>
          Section B: Decide Whether to Proceed With Risk-of-Bias Assessment
        </h3>
        <p className='text-muted-foreground mt-1 text-xs'>
          If B2 or B3 is Yes/Probably Yes, the result is classified as Critical risk of bias.
        </p>
      </div>

      <div className='px-6 py-4'>
        {Object.entries(SECTION_B as Record<string, any>).map(([key, question]) => (
          <div key={key} className='border-border border-b py-4 last:border-b-0'>
            <div className='flex flex-col gap-2'>
              <div className='text-secondary-foreground text-sm'>
                <span className='font-medium'>{key.toUpperCase()}.</span>
                <span className='ml-1'>{question.text}</span>
              </div>

              {question.info && (
                <p className='rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning-foreground'>
                  {question.info}
                </p>
              )}

              <div className='flex flex-wrap gap-2'>
                {responseOptions.map(option => (
                  <label
                    key={option}
                    className={`inline-flex cursor-pointer items-center justify-center rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-blue-300'
                    } focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-1 focus-within:outline-none ${
                      sectionBState?.[key]?.answer === option ?
                        'border-blue-400 bg-blue-50 text-blue-800'
                      : 'border-border bg-card text-secondary-foreground hover:bg-blue-50'
                    }`}
                  >
                    <input
                      type='radio'
                      name={`sectionB-${uniqueId}-${key}`}
                      value={option}
                      checked={sectionBState?.[key]?.answer === option}
                      onChange={() => handleAnswerChange(key, option)}
                      disabled={disabled}
                      className='hidden'
                    />
                    <span className='mr-1'>{option}</span>
                    <span className='text-xs opacity-70'>({RESPONSE_LABELS[option]})</span>
                  </label>
                ))}
              </div>

              <div className='mt-2'>
                <NoteEditor
                  yText={getRobinsText ? getRobinsText('sectionB', 'comment', key) : null}
                  placeholder='Comment (optional)'
                  readOnly={disabled}
                  inline={true}
                />
              </div>
            </div>
          </div>
        ))}

        {stopAssessment && (
          <div className='border-destructive/20 bg-destructive/10 mt-5 rounded-lg border-2 p-4'>
            <div className='flex items-center gap-2'>
              <AlertCircleIcon className='text-destructive size-5' />
              <span className='text-destructive font-semibold'>Assessment Stopped</span>
            </div>
            <p className='text-destructive mt-2 text-sm'>
              Based on the responses to B2 or B3, this result should be classified as
              <span className='font-semibold'> Critical risk of bias</span>. Further domain
              assessment is not required.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
