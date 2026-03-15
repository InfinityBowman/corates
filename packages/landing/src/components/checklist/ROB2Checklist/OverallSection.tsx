/**
 * OverallSection - Overall risk of bias section for ROB2
 * Uses auto-scoring from all domains. Auto-persists calculated judgement.
 */

import { useMemo, useEffect, useCallback } from 'react';
import { BIAS_DIRECTIONS } from './checklist-map';
import { getSmartScoring, mapOverallJudgementToDisplay } from './checklist.js';

interface OverallSectionProps {
  overallState: any;
  checklistState: any;
  onUpdate: (_newState: any) => void;
  disabled?: boolean;
}

export function OverallSection({
  overallState,
  checklistState,
  onUpdate,
  disabled,
}: OverallSectionProps) {
  const smartScoring = useMemo(() => getSmartScoring(checklistState), [checklistState]);
  const calculatedScore = smartScoring.overall;
  const calculatedDisplayJudgement = useMemo(
    () => mapOverallJudgementToDisplay(calculatedScore),
    [calculatedScore],
  );
  const effectiveJudgement = calculatedDisplayJudgement;

  // Auto-persist calculated judgement when it differs from stored.
  // The condition `!== overallState?.judgement` prevents re-entrancy.
  useEffect(() => {
    if (
      calculatedDisplayJudgement &&
      calculatedDisplayJudgement !== overallState?.judgement &&
      !disabled
    ) {
      onUpdate({ ...overallState, judgement: calculatedDisplayJudgement });
    }
  }, [calculatedDisplayJudgement, overallState, onUpdate, disabled]);

  const handleDirectionChange = useCallback(
    (direction: string | null) => {
      onUpdate({ ...overallState, direction });
    },
    [overallState, onUpdate],
  );

  const getJudgementColor = (j: string, isSelected: boolean) => {
    if (!isSelected) return 'border-border bg-muted text-muted-foreground/70';
    switch (j) {
      case 'Low':
      case 'Low risk of bias':
        return 'bg-green-100 border-green-400 text-green-800';
      case 'Some concerns':
        return 'bg-yellow-100 border-yellow-400 text-yellow-800';
      case 'High':
      case 'High risk of bias':
        return 'bg-red-100 border-red-400 text-red-800';
      default:
        return 'bg-muted border-border text-muted-foreground';
    }
  };

  const getScoreBadgeColor = (score: string | null) => {
    switch (score) {
      case 'Low':
        return 'bg-green-100 text-green-800';
      case 'Some concerns':
        return 'bg-yellow-100 text-yellow-800';
      case 'High':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-secondary text-muted-foreground';
    }
  };

  const judgementOptions = ['Low risk of bias', 'Some concerns', 'High risk of bias'];

  return (
    <div className='bg-card overflow-hidden rounded-lg shadow-md'>
      <div className='bg-foreground text-background px-6 py-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h3 className='text-lg font-semibold'>Overall Risk of Bias</h3>
            <p className='text-muted mt-1 text-sm'>
              Final assessment based on all domain judgements
            </p>
          </div>
          {calculatedScore && (calculatedScore as string) !== 'Incomplete' ?
            <span
              className={`rounded-md px-3 py-1 text-sm font-semibold ${getScoreBadgeColor(calculatedScore)}`}
            >
              {calculatedScore}
            </span>
          : (calculatedScore === null || !smartScoring.isComplete) && (
              <span className='bg-muted-foreground/50 text-muted rounded-md px-3 py-1 text-sm'>
                Incomplete
              </span>
            )
          }
        </div>
      </div>

      <div className='px-6 py-5'>
        {/* Calculated score display */}
        <div className='bg-muted mb-5 rounded-lg p-4'>
          <div className='flex items-center gap-3'>
            <span className='text-secondary-foreground text-sm font-medium'>
              Calculated judgement:
            </span>
            {effectiveJudgement ?
              <span
                className={`rounded-md px-2.5 py-1 text-sm font-medium ${getScoreBadgeColor(calculatedScore)}`}
              >
                {effectiveJudgement}
              </span>
            : <span className='text-muted-foreground/70 text-sm'>Complete all domains</span>}
          </div>
        </div>

        {/* Overall judgement display (read-only) */}
        <div className='mb-5'>
          <div className='text-secondary-foreground mb-3 text-sm font-medium'>
            Overall risk of bias judgement
          </div>
          <div className='flex flex-wrap gap-2'>
            {judgementOptions.map(j => {
              const isSelected = effectiveJudgement === j;
              return (
                <div
                  key={j}
                  className={`inline-flex cursor-not-allowed items-center justify-center rounded-lg border-2 px-4 py-2 text-sm font-medium opacity-75 ${getJudgementColor(j, isSelected)}`}
                >
                  {j}
                </div>
              );
            })}
          </div>
        </div>

        {/* Direction of bias */}
        <div>
          <div className='text-secondary-foreground mb-3 text-sm font-medium'>
            Predicted direction of bias
            <span className='text-muted-foreground/70 ml-1 font-normal'>(optional)</span>
          </div>
          <div className='flex flex-wrap gap-2'>
            {BIAS_DIRECTIONS.map(d => {
              const isSelected = overallState?.direction === d;
              return (
                <button
                  key={d}
                  type='button'
                  onClick={() => {
                    if (disabled) return;
                    handleDirectionChange(isSelected ? null : d);
                  }}
                  disabled={disabled}
                  className={`inline-flex items-center justify-center rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
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
      </div>
    </div>
  );
}
