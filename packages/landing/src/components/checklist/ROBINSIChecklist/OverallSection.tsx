/**
 * OverallSection - ROBINS-I overall risk of bias section
 * Auto-first scoring with manual override support.
 */

import { useMemo, useEffect, useCallback } from 'react';
import { OVERALL_ROB_JUDGEMENTS, BIAS_DIRECTIONS } from './checklist-map';
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

  const isManualMode = overallState?.judgementSource === 'manual';
  const effectiveJudgement = isManualMode && overallState?.judgement
    ? overallState.judgement
    : calculatedDisplayJudgement;

  // Auto-persist calculated judgement in auto mode.
  // Deps track only the specific fields the SolidJS createEffect(on(...)) tracked.
  // overallState is read inside the effect but only overallState?.judgement is in deps
  // to avoid re-triggering on direction changes.
  useEffect(() => {
    if (!isManualMode && calculatedDisplayJudgement && calculatedDisplayJudgement !== overallState?.judgement && !disabled) {
      onUpdate({ ...(overallState || {}), judgement: calculatedDisplayJudgement, judgementSource: 'auto' });
    }
  }, [calculatedDisplayJudgement, isManualMode, overallState?.judgement, disabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJudgementChange = useCallback(
    (judgement: string | null) => {
      onUpdate({ ...overallState, judgement, judgementSource: 'manual' });
    },
    [overallState, onUpdate],
  );

  const handleDirectionChange = useCallback(
    (direction: string | null) => {
      onUpdate({ ...overallState, direction });
    },
    [overallState, onUpdate],
  );

  const handleRevertToAuto = useCallback(() => {
    onUpdate({ ...(overallState || {}), judgement: calculatedDisplayJudgement, judgementSource: 'auto' });
  }, [overallState, calculatedDisplayJudgement, onUpdate]);

  const handleSwitchToManual = useCallback(() => {
    const currentState = overallState || {};
    onUpdate({
      ...currentState,
      judgement: currentState.judgement || calculatedDisplayJudgement,
      judgementSource: 'manual',
    });
  }, [overallState, calculatedDisplayJudgement, onUpdate]);

  const getJudgementColor = (j: string, isSelected: boolean) => {
    if (!isSelected) {
      return isManualMode
        ? 'border-border bg-card text-muted-foreground hover:border-border'
        : 'border-border bg-muted text-muted-foreground hover:border-border hover:bg-card';
    }
    switch (j) {
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

  const getScoreBadgeColor = (score: string | null) => {
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
    <div className="bg-card overflow-hidden rounded-lg shadow-md">
      <div className="bg-foreground text-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Overall Risk of Bias</h3>
            <p className="text-muted mt-1 text-sm">Final assessment based on all domain judgements</p>
          </div>

          {calculatedScore && (calculatedScore as string) !== 'Incomplete' ? (
            <div className="flex flex-col items-end gap-1">
              <span className={`rounded-md px-3 py-1 text-sm font-semibold ${getScoreBadgeColor(calculatedScore)}`}>
                {calculatedScore}
              </span>
              {isManualMode && <span className="text-xs text-amber-300">Manual override</span>}
            </div>
          ) : (calculatedScore as string) === 'Incomplete' ? (
            <span className="bg-muted-foreground/50 text-muted rounded-md px-3 py-1 text-sm">
              Incomplete
            </span>
          ) : null}
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Calculated score with mode toggle */}
        <div className="bg-muted mb-5 flex items-center justify-between rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-secondary-foreground text-sm font-medium">Calculated judgement:</span>
            {calculatedDisplayJudgement ? (
              <span className={`rounded-md px-2.5 py-1 text-sm font-medium ${getScoreBadgeColor(calculatedScore)}`}>
                {calculatedDisplayJudgement}
              </span>
            ) : (
              <span className="text-muted-foreground/70 text-sm">Complete all domains</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="border-border bg-card flex rounded-md border text-xs">
              <button
                type="button"
                onClick={handleRevertToAuto}
                disabled={disabled}
                className={`rounded-l-md px-2.5 py-1 transition-colors ${
                  !isManualMode ? 'bg-blue-100 text-blue-800' : 'text-muted-foreground hover:bg-muted'
                } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={handleSwitchToManual}
                disabled={disabled}
                className={`border-border rounded-r-md border-l px-2.5 py-1 transition-colors ${
                  isManualMode ? 'bg-amber-100 text-amber-800' : 'text-muted-foreground hover:bg-muted'
                } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                Manual
              </button>
            </div>
          </div>
        </div>

        {/* Judgement buttons */}
        <div className="mb-5">
          <div className="text-secondary-foreground mb-3 text-sm font-medium">
            Overall risk of bias judgement
          </div>
          <div className="flex flex-wrap gap-2">
            {OVERALL_ROB_JUDGEMENTS.map(j => {
              const isSelected = effectiveJudgement === j;
              return (
                <button
                  key={j}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    handleJudgementChange(isSelected ? null : j);
                  }}
                  disabled={disabled}
                  className={`inline-flex items-center justify-center rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  } ${getJudgementColor(j, isSelected)}`}
                >
                  {j}
                </button>
              );
            })}
          </div>
        </div>

        {/* Direction */}
        <div>
          <div className="text-secondary-foreground mb-3 text-sm font-medium">
            Predicted direction of bias
            <span className="text-muted-foreground/70 ml-1 font-normal">(optional)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {BIAS_DIRECTIONS.map(d => {
              const isSelected = overallState?.direction === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    handleDirectionChange(isSelected ? null : d);
                  }}
                  disabled={disabled}
                  className={`inline-flex items-center justify-center rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
                    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'border-blue-400 bg-blue-100 text-blue-800'
                      : 'text-muted-foreground border-border bg-muted hover:border-border'
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
