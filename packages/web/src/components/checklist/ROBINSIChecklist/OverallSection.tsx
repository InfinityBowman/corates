import { OVERALL_ROB_JUDGEMENTS, BIAS_DIRECTIONS } from './checklist-map';
import { mapOverallJudgementToDisplay } from './checklist.js';
import {
  useAnswer,
  useAnswersYMap,
  useROBINSIScore,
} from '@/primitives/useProject/reactor/hooks';

interface OverallSectionProps {
  studyId: string;
  checklistId: string;
  disabled?: boolean;
}

export function OverallSection({
  studyId,
  checklistId,
  disabled,
}: OverallSectionProps) {
  const calculatedScore = useROBINSIScore(studyId, checklistId);
  const isIncomplete = calculatedScore === 'Incomplete';
  const calculatedDisplayJudgement = isIncomplete ? null : mapOverallJudgementToDisplay(calculatedScore as any);

  const judgementSource = useAnswer<string>(studyId, checklistId, 'overall.judgementSource');
  const manualJudgement = useAnswer<string>(studyId, checklistId, 'overall.judgement');
  const direction = useAnswer<string>(studyId, checklistId, 'overall.direction');
  const answersYMap = useAnswersYMap(studyId, checklistId);

  const isManualMode = judgementSource === 'manual';
  const effectiveJudgement =
    isManualMode && manualJudgement ? manualJudgement : calculatedDisplayJudgement;

  const handleJudgementChange = (judgement: string | null) => {
    answersYMap?.set('overall.judgement', judgement);
    answersYMap?.set('overall.judgementSource', 'manual');
  };

  const handleDirectionChange = (dir: string | null) => {
    answersYMap?.set('overall.direction', dir);
  };

  const handleRevertToAuto = () => {
    answersYMap?.set('overall.judgement', calculatedDisplayJudgement);
    answersYMap?.set('overall.judgementSource', 'auto');
  };

  const handleSwitchToManual = () => {
    answersYMap?.set('overall.judgement', manualJudgement || calculatedDisplayJudgement);
    answersYMap?.set('overall.judgementSource', 'manual');
  };

  const getJudgementColor = (j: string, isSelected: boolean) => {
    if (!isSelected) {
      return isManualMode ?
          'border-border bg-card text-muted-foreground hover:border-border'
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
    <div className='bg-card overflow-hidden rounded-lg shadow-md'>
      <div className='bg-foreground text-background px-6 py-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h3 className='text-lg font-semibold'>Overall Risk of Bias</h3>
            <p className='text-muted mt-1 text-sm'>
              Final assessment based on all domain judgements
            </p>
          </div>

          {!isIncomplete ?
            <div className='flex flex-col items-end gap-1'>
              <span
                className={`rounded-md px-3 py-1 text-sm font-semibold ${getScoreBadgeColor(calculatedScore)}`}
              >
                {calculatedScore}
              </span>
              {isManualMode && <span className='text-warning text-xs'>Manual override</span>}
            </div>
          : <span className='bg-muted-foreground/50 text-muted rounded-md px-3 py-1 text-sm'>
              Incomplete
            </span>
          }
        </div>
      </div>

      <div className='px-6 py-5'>
        {/* Calculated score with mode toggle */}
        <div className='bg-muted mb-5 flex items-center justify-between rounded-lg p-4'>
          <div className='flex items-center gap-3'>
            <span className='text-secondary-foreground text-sm font-medium'>
              Calculated judgement:
            </span>
            {calculatedDisplayJudgement ?
              <span
                className={`rounded-md px-2.5 py-1 text-sm font-medium ${getScoreBadgeColor(calculatedScore)}`}
              >
                {calculatedDisplayJudgement}
              </span>
            : <span className='text-muted-foreground/70 text-sm'>Complete all domains</span>}
          </div>

          <div className='flex items-center gap-2'>
            <div className='border-border bg-card flex rounded-md border text-xs'>
              <button
                type='button'
                onClick={handleRevertToAuto}
                disabled={disabled}
                className={`rounded-l-md px-2.5 py-1 transition-colors ${
                  !isManualMode ?
                    'bg-blue-100 text-blue-800'
                  : 'text-muted-foreground hover:bg-muted'
                } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                Auto
              </button>
              <button
                type='button'
                onClick={handleSwitchToManual}
                disabled={disabled}
                className={`border-border rounded-r-md border-l px-2.5 py-1 transition-colors ${
                  isManualMode ?
                    'bg-warning-bg text-warning-foreground'
                  : 'text-muted-foreground hover:bg-muted'
                } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                Manual
              </button>
            </div>
          </div>
        </div>

        {/* Judgement buttons */}
        <div className='mb-5'>
          <div className='text-secondary-foreground mb-3 text-sm font-medium'>
            Overall risk of bias judgement
          </div>
          <div className='flex flex-wrap gap-2'>
            {OVERALL_ROB_JUDGEMENTS.map(j => {
              const isSelected = effectiveJudgement === j;
              return (
                <button
                  key={j}
                  type='button'
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
          <div className='text-secondary-foreground mb-3 text-sm font-medium'>
            Predicted direction of bias
            <span className='text-muted-foreground/70 ml-1 font-normal'>(optional)</span>
          </div>
          <div className='flex flex-wrap gap-2'>
            {BIAS_DIRECTIONS.map(d => {
              const isSelected = direction === d;
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
